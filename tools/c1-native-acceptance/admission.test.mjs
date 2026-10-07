import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import {
  readPublicConfig,
  issueOidc,
  verifyAssertion,
  verifyAttribution,
  boundedText,
} from "./admission.mjs";
import { manifest } from "./policy.mjs";
const sha = "a".repeat(40);
test("public configuration is read only from exact-origin nonexecuted module, never secret lookup", async () => {
  const pages = {
    "/": '<script type="module" src="/assets/index-reviewed.js"></script>',
    "/assets/index-reviewed.js":
      'function config(env={VITE_SUPABASE_URL:"' +
      manifest.provider +
      '",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",VITE_LIFE_RHYTHM_MODE:"required",VITE_LIFE_RHYTHM_AUTH_ENABLED:"true"}){return [env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,env.VITE_LIFE_RHYTHM_AUTH_ENABLED,env.VITE_LIFE_RHYTHM_MODE]}',
  };
  assert.equal(
    (await readPublicConfig(async (u) => pages[new URL(u).pathname]))
      .publishableKey,
    "sb_publishable_synthetic",
  );
  for (const change of [
    (p) =>
      (p["/"] = '<script type="module" src="https://evil.test/a.js"></script>'),
    (p) => (p["/assets/index-reviewed.js"] += ' "sb_publishable_other"'),
    (p) =>
      (p["/assets/index-reviewed.js"] = p["/assets/index-reviewed.js"].replace(
        manifest.provider,
        "https://evil.supabase.co",
      )),
    (p) =>
      (p["/assets/index-reviewed.js"] = p["/assets/index-reviewed.js"].replace(
        '"true"',
        '"false"',
      )),
  ]) {
    const p = { ...pages };
    change(p);
    await assert.rejects(readPublicConfig(async (u) => p[new URL(u).pathname]));
  }
});
async function signing() {
  const k = await generateKeyPair("RS256");
  return { ...k, jwk: await exportJWK(k.publicKey) };
}
const claims = () => ({
  repository: manifest.repository,
  repository_id: manifest.repositoryId,
  repository_owner_id: manifest.ownerId,
  ref: "refs/heads/main",
  environment: "c1-native-preview",
  event_name: "workflow_dispatch",
  workflow_ref: manifest.workflowRef,
  workflow_sha: sha,
  runner_environment: "github-hosted",
  run_id: "123",
  run_attempt: "1",
});
test("OIDC request authenticates only GitHub runtime endpoint, verifies signature and exact claims in memory", async () => {
  const k = await signing();
  const token = await new SignJWT(claims())
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience("https://github.com/dezrobbo1")
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("5m")
    .sign(k.privateKey);
  let calls = [];
  const fetcher = async (u, o) => {
    calls.push([u, o]);
    return Response.json(
      u.endsWith("/openid-configuration")
        ? {
            jwks_uri:
              "https://token.actions.githubusercontent.com/.well-known/jwks",
          }
        : u.endsWith("/jwks")
          ? { keys: [{ ...k.jwk, kid: "test" }] }
          : { count: 1, value: token },
    );
  };
  const env = {
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://pipelines.actions.githubusercontent.com/oidc?api-version=1",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
  };
  assert.equal(await issueOidc(env, sha, fetcher), token);
  assert(calls[0][0].includes("audience=https%3A%2F%2Fgithub.com%2Fdezrobbo1"));
  assert.equal(
    calls[0][1].headers.Authorization,
    "Bearer synthetic-request-token",
  );
  assert(calls.slice(1).every(([, o]) => !o.headers?.Authorization));
  await assert.rejects(
    issueOidc(
      { ...env, ACTIONS_ID_TOKEN_REQUEST_URL: "https://evil.test/oidc" },
      sha,
      fetcher,
    ),
  );
  await assert.rejects(
    issueOidc({ ...env, GITHUB_RUN_ID: "wrong" }, sha, fetcher),
  );
  await assert.rejects(issueOidc(env, "b".repeat(40), fetcher));
});
const binding = (phase, nonce) => ({
  format: 1,
  phase,
  nonce,
  repository: manifest.repository,
  source: manifest.source,
  deployment: manifest.deployment,
  project: manifest.project,
  team: manifest.team,
  origin: manifest.origin,
  immutableOrigin: manifest.origin,
  environment: "preview",
  state: "READY",
  observedAt: Math.floor(Date.now() / 1000),
});
test("fresh signed attribution binds nonce, phase and all provider facts; JSON alone/replay/drift fail", async () => {
  const k = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const jwk = await exportJWK(k.publicKey);
  const nonce = "n".repeat(64);
  const c = {
    enabled: true,
    endpoint: "https://verifier.example.test/c1",
    publicJwk: jwk,
  };
  const sign = async (v) =>
    new SignJWT(v)
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuer(c.endpoint)
      .setAudience(manifest.repository)
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(k.privateKey);
  const good = await sign(binding("start", nonce));
  await verifyAssertion(good, c, "start", nonce);
  for (const patch of [
    { source: sha },
    { origin: "https://evil.test" },
    { environment: "production" },
    { observedAt: 1 },
    { nonce: "bad" },
    { phase: "end" },
  ])
    await assert.rejects(
      verifyAssertion(
        await sign({ ...binding("start", nonce), ...patch }),
        c,
        "start",
        nonce,
      ),
    );
  await assert.rejects(
    verifyAssertion(JSON.stringify(binding("start", nonce)), c, "start", nonce),
  );
  await assert.rejects(
    verifyAttribution({ enabled: false }, "start", async () => {
      throw Error("must not fetch");
    }),
  );
});
test("mutable alias cannot reach attribution reader or credentials even with enabled configuration", async () => {
  const k = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  let calls = 0;
  await assert.rejects(
    verifyAttribution(
      {
        enabled: true,
        immutableOriginApproved: true,
        immutableOrigin: manifest.origin,
        endpoint: "https://verifier.example.test/c1",
        publicJwk: await exportJWK(k.publicKey),
      },
      "start",
      async () => {
        calls++;
      },
    ),
  );
  assert.equal(calls, 0);
});
test("response reader bounds streaming bodies before buffering and cancels excess", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(20));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(boundedText(new Response(stream), 10));
  assert(cancelled);
});
test("OIDC token signature corruption cannot pass verified claims", async () => {
  const k = await signing();
  const valid = await new SignJWT(claims())
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience("https://github.com/dezrobbo1")
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("5m")
    .sign(k.privateKey);
  const parts = valid.split(".");
  parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
  const f = async (u) =>
    Response.json(
      u.endsWith("/openid-configuration")
        ? {
            jwks_uri:
              "https://token.actions.githubusercontent.com/.well-known/jwks",
          }
        : u.endsWith("/jwks")
          ? { keys: [{ ...k.jwk, kid: "test" }] }
          : { value: parts.join(".") },
    );
  await assert.rejects(
    issueOidc(
      {
        ACTIONS_ID_TOKEN_REQUEST_URL:
          "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic",
        GITHUB_RUN_ID: "123",
        GITHUB_RUN_ATTEMPT: "1",
      },
      sha,
      f,
    ),
  );
});
