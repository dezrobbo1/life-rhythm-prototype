import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metadataCases,
  verifySession,
  makeTransport,
  runMetadata,
} from "./native.mjs";
import { manifest, Budget } from "./policy.mjs";
test("native case matrix has no method other than GET and includes safe conflicts", () => {
  const cases = metadataCases(
    manifest.accounts[0],
    "11111111-1111-4111-8111-111111111111",
  );
  assert(cases.some((x) => x.status === 409));
  assert(cases.some((x) => x.status === 426));
  assert(cases.some((x) => x.status === 400));
  assert(
    cases.every(
      (x) => x.method === "GET" && x.path.startsWith("/api/account/boundary"),
    ),
  );
});
test("transport blocks redirect and writes before fetch, never gives OIDC to provider", async () => {
  let calls = [];
  const tx = makeTransport("oidc", new Budget(), async (url, init) => {
    calls.push([url, init]);
    return new Response("{}", {
      headers: { "content-type": "application/json" },
    });
  });
  await tx(manifest.provider + "/auth/v1/user");
  assert.equal(
    calls[0][1].headers["x-vercel-trusted-oidc-idp-token"],
    undefined,
  );
  await tx(manifest.origin + "/");
  assert.equal(calls[1][1].headers["x-vercel-trusted-oidc-idp-token"], "oidc");
  assert.equal(calls[1][1].redirect, "error");
  await assert.rejects(
    tx(manifest.provider + "/rest/v1/account_heads", { method: "DELETE" }),
  );
  assert.equal(calls.length, 2);
  const redirect = makeTransport(
    "oidc",
    new Budget(),
    async () =>
      new Response("", {
        status: 302,
        headers: { location: "https://evil.test" },
      }),
  );
  await assert.rejects(redirect(manifest.origin + "/"));
});
test("invalid, wrong-identity and unverified tokens fail positive identity controls", async () => {
  await assert.rejects(
    verifySession("not.jwt", manifest.accounts[0], () => {}),
  );
});
test("metadata runner rejects empty own control instead of claiming isolation", async () => {
  await assert.rejects(
    runMetadata(
      async () => ({ response: new Response("[]"), body: [] }),
      manifest.accounts[0],
      "memory-token",
    ),
  );
});
import { generateKeyPair, SignJWT } from "jose";
import { login, refresh, logout } from "./native.mjs";
test("real cryptographic positive A/B controls reject swapped, expired, issuer and role tokens", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const sign = async (account, overrides = {}) =>
    new SignJWT({
      role: "authenticated",
      session_id: "11111111-1111-4111-8111-111111111111",
      ...overrides,
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(overrides.issuer ?? manifest.provider + "/auth/v1")
      .setAudience("authenticated")
      .setSubject(account.uuid)
      .setExpirationTime(overrides.exp ?? "5m")
      .sign(privateKey);
  for (const a of manifest.accounts)
    assert.equal(
      await verifySession(await sign(a), a, publicKey),
      "11111111-1111-4111-8111-111111111111",
    );
  await assert.rejects(
    verifySession(
      await sign(manifest.accounts[0]),
      manifest.accounts[1],
      publicKey,
    ),
  );
  for (const o of [
    { issuer: "https://evil.test" },
    { role: "service_role" },
    { exp: 1 },
  ])
    await assert.rejects(
      verifySession(
        await sign(manifest.accounts[0], o),
        manifest.accounts[0],
        publicKey,
      ),
    );
});
test("login and refresh bind normal identity and logout uses local scope only", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const a = manifest.accounts[0];
  const token = await new SignJWT({
    role: "authenticated",
    session_id: "11111111-1111-4111-8111-111111111111",
  })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(manifest.provider + "/auth/v1")
    .setAudience("authenticated")
    .setSubject(a.uuid)
    .setExpirationTime("5m")
    .sign(privateKey);
  const session = {
    access_token: token,
    refresh_token: "synthetic-refresh",
    user: { id: a.uuid },
  };
  let urls = [];
  const tx = async (u, o) => {
    urls.push(u);
    return {
      response: new Response(null, {
        status: u.includes("logout") ? 204 : 200,
      }),
      body: session,
    };
  };
  assert.equal(
    (
      await login(
        tx,
        a,
        "synthetic-password",
        publicKey,
        "sb_publishable_synthetic",
      )
    ).user.id,
    a.uuid,
  );
  await refresh(tx, a, session, publicKey, "sb_publishable_synthetic");
  await logout(tx, session, "sb_publishable_synthetic");
  assert(urls[2].endsWith("/logout?scope=local"));
  assert(urls[1].includes("grant_type=refresh_token"));
});
test("provider positive/cross reads and native matrix run without any metadata writes", async () => {
  const a = manifest.accounts[0],
    generation = "11111111-1111-4111-8111-111111111111";
  let calls = [];
  const tx = async (u, o = {}) => {
    calls.push([u, o]);
    const url = new URL(u);
    let status = 200,
      body;
    if (url.origin === manifest.provider)
      body =
        url.searchParams.get("subject") === "eq." + a.uuid
          ? [
              {
                enabled: true,
                subject: a.uuid,
                account_heads: {
                  protocol_version: 1,
                  canonical_schema_version: 1,
                  revision: a.revision,
                  generation,
                },
              },
            ]
          : [];
    else {
      const c = metadataCases(a, generation).find(
        (c) => c.path === url.pathname + url.search,
      );
      status = o.headers.Authorization ? c.status : 401;
      body =
        status === 200
          ? {
              kind: "ready",
              protocolVersion: 1,
              schemaVersion: 1,
              buildId: manifest.source,
              head: { revision: a.revision, generation },
            }
          : {
              kind: status === 409 ? "conflict" : "error",
              category: {
                400: "invalid-request",
                401: "unauthorized",
                409: "conflict",
                426: "upgrade-required",
              }[status],
              requestId: generation,
              ...(status === 409
                ? { head: { revision: a.revision, generation } }
                : {}),
            };
    }
    if (url.pathname === "/rest/v1/account_heads" && body.length)
      body = [{ subject: a.uuid, ...body[0].account_heads }];
    return {
      response: new Response(JSON.stringify(body), {
        status,
        headers: {
          "content-type": "application/json",
          "cache-control": "private, no-store",
        },
      }),
      body,
    };
  };
  assert.equal(
    (await runMetadata(tx, a, "synthetic-token", "sb_publishable_synthetic"))
      .revision,
    a.revision,
  );
  assert(calls.every(([, o]) => !o.method || o.method === "GET"));
});
test("caller-supplied protection headers cannot reach provider even with alternate casing", async () => {
  let headers;
  const tx = makeTransport("oidc", new Budget(), async (u, o) => {
    headers = o.headers;
    return new Response("{}");
  });
  await tx(manifest.provider + "/auth/v1/user", {
    headers: { "X-Vercel-Trusted-Oidc-Idp-Token": "synthetic-leak" },
  });
  assert(
    !Object.keys(headers).some(
      (k) => k.toLowerCase() === "x-vercel-trusted-oidc-idp-token",
    ),
  );
});
