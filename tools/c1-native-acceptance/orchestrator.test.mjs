import { test } from "node:test";
import assert from "node:assert/strict";
import { executeAcceptance } from "./orchestrator.mjs";
import { manifest } from "./policy.mjs";
const sha = "a".repeat(40);
const env = {
  GITHUB_REPOSITORY: manifest.repository,
  GITHUB_REPOSITORY_ID: manifest.repositoryId,
  GITHUB_REPOSITORY_OWNER_ID: manifest.ownerId,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: manifest.workflowRef,
  GITHUB_WORKFLOW_SHA: sha,
  C1_HARNESS_SHA: sha,
  RUNNER_ENVIRONMENT: "github-hosted",
  C1_ENABLED: "true",
  C1_TRUSTED_SHA: sha,
  C1_ACCOUNT_A_PASSWORD: "synthetic-A",
  C1_ACCOUNT_B_PASSWORD: "synthetic-B",
};
function adapters(log, failAt) {
  return {
    preflight: async () => {
      log.push("preflight");
    },
    attribution: async (c, phase) => {
      log.push("attribution-" + phase);
      if (failAt === phase) throw Error("synthetic-secret-error");
    },
    oidc: async () => {
      log.push("oidc");
      return "synthetic-oidc";
    },
    publicConfig: async () => {
      log.push("public-config");
      return { publishableKey: "sb_publishable_synthetic" };
    },
    key: async () => ({}),
    transport: () => () => {},
    login: async (tx, a, p, k, key, onSession) => {
      log.push("login-" + a.label);
      const s = { access_token: "synthetic-" + a.label };
      onSession(s);
      if (failAt === "login") throw Error("synthetic-secret-error");
      return s;
    },
    metadata: async (tx, a) => {
      log.push("metadata-" + a.label);
      return { revision: a.revision };
    },
    readHead: async (tx, a) => ({ revision: a.revision }),
    refresh: async (tx, a, s, k, key, onSession) => {
      log.push("refresh-" + a.label);
      onSession(s);
      return s;
    },
    logout: async () => {
      log.push("local-logout");
      if (failAt === "cleanup") throw Error("synthetic-secret-error");
    },
    browser: async () => ({
      version: () => "153.0.8010.12",
      close: async () => {
        log.push("browser-close");
      },
    }),
    browserRow: async (b, w, a) => {
      log.push("browser-" + w + "-" + a.label);
      return "ui-" + w;
    },
  };
}
test("executable orchestrator sequences both metadata controls, refresh, minimal browsers, cleanup and final guards", async () => {
  const log = [];
  const r = await executeAcceptance(env, { enabled: true }, adapters(log));
  assert.equal(r.hosted, "SCOPED_ROWS_COMPLETE");
  assert.equal(r.gate, "BLOCK");
  assert(log.indexOf("attribution-start") < log.indexOf("login-A"));
  assert(log.indexOf("browser-close") < log.indexOf("attribution-end"));
  assert.equal(log.filter((x) => x === "preflight").length, 7);
  assert.deepEqual(
    log.filter((x) => x.startsWith("browser-") && x !== "browser-close"),
    ["browser-390-A", "browser-390-B", "browser-1280-A"],
  );
});
test("missing attribution blocks before OIDC, config, passwords or login", async () => {
  const log = [];
  const blocked = { ...env };
  delete blocked.C1_ACCOUNT_A_PASSWORD;
  Object.defineProperty(blocked, "C1_ACCOUNT_A_PASSWORD", {
    get() {
      throw Error("password-read");
    },
  });
  const r = await executeAcceptance(
    blocked,
    { enabled: false },
    adapters(log, "start"),
  );
  assert.equal(r.hosted, "NOT_RUN");
  assert(!log.includes("oidc"));
  assert(!log.some((x) => x.startsWith("login")));
});
test("unexpected login, final drift and cleanup failures cannot report scoped completion or raw secrets", async () => {
  for (const fail of ["login", "end", "cleanup"]) {
    const log = [];
    const r = await executeAcceptance(
      env,
      { enabled: true },
      adapters(log, fail),
    );
    assert.equal(r.gate, "BLOCK");
    assert.notEqual(r.hosted, "SCOPED_ROWS_COMPLETE");
    assert(!JSON.stringify(r).includes("synthetic-secret"));
    if (fail === "login") assert(log.includes("local-logout"));
  }
});
test("hanging work times out, aborts future requests and attempts bounded local cleanup", async () => {
  const log = [];
  const d = adapters(log);
  d.metadata = () => new Promise(() => {});
  d.timeoutMs = 10;
  let signal;
  d.transport = (o, b, f, s) => {
    if (s) signal = s;
    return () => {};
  };
  const r = await executeAcceptance(env, { enabled: true }, d);
  assert.equal(r.hosted, "ATTEMPTED_BLOCKED");
  assert(signal.aborted);
  assert(log.includes("local-logout"));
});
test("final provider head drift blocks completion and closes every held session", async () => {
  const log = [];
  const d = adapters(log);
  d.readHead = async () => ({ revision: "0" });
  const r = await executeAcceptance(env, { enabled: true }, d);
  assert.equal(r.hosted, "ATTEMPTED_BLOCKED");
  assert(log.includes("browser-close"));
  assert.equal(log.filter((x) => x === "local-logout").length, 2);
});
test("raw invalid harness configuration never appears in sanitized evidence", async () => {
  const log = [];
  const r = await executeAcceptance(
    { ...env, C1_TRUSTED_SHA: "synthetic-secret-harness" },
    null,
    adapters(log),
  );
  assert(!JSON.stringify(r).includes("synthetic-secret"));
  assert.equal(r.hosted, "NOT_RUN");
});
