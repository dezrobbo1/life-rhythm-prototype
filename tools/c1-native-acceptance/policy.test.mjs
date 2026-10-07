import { test } from "node:test";
import assert from "node:assert/strict";
import {
  manifest,
  guardIdentity,
  guardClaims,
  scopedHeaders,
  requestPolicy,
  Budget,
  positiveRows,
  boundary,
  report,
  cleanup,
  withTimeout,
  requireAttribution,
} from "./policy.mjs";
const sha = "a".repeat(40);
const identity = {
  repository: manifest.repository,
  repositoryId: "1268056225",
  ownerId: "228294552",
  event: "workflow_dispatch",
  ref: "refs/heads/main",
  workflowRef: manifest.workflowRef,
  workflowSha: sha,
  harnessSha: sha,
  runner: "github-hosted",
  enabled: "true",
};
test("dispatch identity binds immutable workflow and harness, rejects missing bootstrap", () => {
  guardIdentity(identity, sha);
  for (const key of Object.keys(identity))
    assert.throws(() => guardIdentity({ ...identity, [key]: "bad" }, sha));
  assert.throws(() => guardIdentity(identity, ""));
});
test("OIDC scope guards all claims including workflow SHA without legacy sub assumption", () => {
  const c = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://github.com/dezrobbo1",
    repository: manifest.repository,
    repository_id: "1268056225",
    repository_owner_id: "228294552",
    ref: "refs/heads/main",
    environment: "c1-native-preview",
    event_name: "workflow_dispatch",
    workflow_ref: manifest.workflowRef,
    workflow_sha: sha,
    runner_environment: "github-hosted",
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  guardClaims(c, sha);
  for (const key of Object.keys(c))
    assert.throws(() => guardClaims({ ...c, [key]: "bad" }, sha));
});
test("exact origin header never leaks to provider, foreign origins, userinfo or redirect", () => {
  assert.equal(
    scopedHeaders(manifest.origin + "/", "oidc")[
      "x-vercel-trusted-oidc-idp-token"
    ],
    "oidc",
  );
  assert.equal(
    scopedHeaders(manifest.provider + "/auth/v1/token", "oidc")[
      "x-vercel-trusted-oidc-idp-token"
    ],
    undefined,
  );
  for (const u of [
    "https://evil.test",
    manifest.origin + ".evil.test",
    "https://user@" + new URL(manifest.origin).host,
  ])
    assert.throws(() => scopedHeaders(u, "oidc"));
  assert.throws(() => requestPolicy(manifest.origin + "/", "GET", true));
});
test("request allowlist forbids metadata mutations and global logout", () => {
  requestPolicy(
    manifest.provider + "/auth/v1/token?grant_type=password",
    "POST",
  );
  requestPolicy(manifest.provider + "/auth/v1/logout?scope=local", "POST");
  for (const [u, m] of [
    [manifest.provider + "/rest/v1/trial_access", "POST"],
    [manifest.provider + "/rest/v1/account_heads", "DELETE"],
    [manifest.provider + "/auth/v1/logout", "POST"],
    [manifest.origin + "/api/account/boundary", "PUT"],
    [manifest.provider + "/auth/v1/signup", "POST"],
  ])
    assert.throws(() => requestPolicy(u, m));
});
test("positive controls require exactly own enabled metadata and lossless bigint", () => {
  const a = manifest.accounts[0];
  const row = {
    enabled: true,
    subject: a.uuid,
    account_heads: {
      protocol_version: 1,
      canonical_schema_version: 1,
      revision: a.revision,
      generation: "11111111-1111-4111-8111-111111111111",
    },
  };
  positiveRows([row], a);
  for (const rows of [
    [],
    [row, row],
    [{ ...row, subject: manifest.accounts[1].uuid }],
    [{ ...row, enabled: false }],
    [
      {
        ...row,
        account_heads: { ...row.account_heads, revision: 9007199254740993 },
      },
    ],
  ])
    assert.throws(() => positiveRows(rows, a));
});
test("boundary accepts only strict JSON/no-store/source and sanitized errors", () => {
  const a = manifest.accounts[0];
  const h = {
    revision: a.revision,
    generation: "11111111-1111-4111-8111-111111111111",
  };
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  boundary(
    { status: 200, headers },
    {
      kind: "ready",
      protocolVersion: 1,
      schemaVersion: 1,
      buildId: manifest.source,
      head: h,
    },
    200,
    a,
  );
  for (const body of [
    {
      kind: "error",
      category: "invalid-request",
      requestId: h.generation,
      secret: "oops",
    },
    {
      kind: "ready",
      protocolVersion: 1,
      schemaVersion: 1,
      buildId: "wrong",
      head: h,
    },
  ])
    assert.throws(() => boundary({ status: 200, headers }, body, 200, a));
  assert.throws(() =>
    boundary(
      { status: 200, headers: new Headers({ "content-type": "text/html" }) },
      {},
      200,
      a,
    ),
  );
});
test("shared budget is bounded, reserves cleanup and limits signins", () => {
  const b = new Budget();
  for (let i = 0; i < 190; i++) b.take();
  assert.throws(() => b.take());
  for (let i = 0; i < 10; i++) b.take({ cleanup: true });
  assert.throws(() => b.take({ cleanup: true }));
  const s = new Budget();
  for (let i = 0; i < 8; i++) s.take({ signin: true });
  assert.throws(() => s.take({ signin: true }));
  assert.throws(() => new Budget(Date.now() - 1200001).take());
});
test("output is enum-only, rejects raw errors, credentials and unknown artifact fields", () => {
  assert.equal(report(["identity", "api"], "BLOCK").gate, "BLOCK");
  for (const v of [
    "Bearer eyJtoken",
    "password",
    new Error("token"),
    "email@example.test",
  ])
    assert.throws(() => report([v], "BLOCK"));
  assert.throws(() => report(["api"], "PASS"));
  assert.doesNotMatch(
    JSON.stringify(report(["api"], "BLOCK")),
    /test1@|eyJ|refresh_token|password/,
  );
});
test("cleanup attempts all resources and fails closed if one fails", async () => {
  let calls = 0;
  await assert.rejects(
    cleanup([
      async () => {
        calls++;
        throw Error("secret");
      },
      async () => {
        calls++;
      },
    ]),
  );
  assert.equal(calls, 2);
});
test("timeouts and missing secure deployment attribution block before credentials", async () => {
  await assert.rejects(withTimeout(() => new Promise(() => {}), 10));
  assert.throws(() =>
    requireAttribution({
      deployment: manifest.deployment,
      source: manifest.source,
      origin: manifest.origin,
    }),
  );
});
