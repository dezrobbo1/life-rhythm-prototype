import { test } from "node:test";
import assert from "node:assert/strict";
import { executeAcceptance } from "./orchestrator.mjs";
import { manifest, scopedHeaders } from "./policy.mjs";
const sha = "a".repeat(40);
const env = {
  C1_JOB_STARTED_AT: String(Date.now()),
  C1_JOB_DEADLINE_MS: String(Date.now() + 19 * 60 * 1000),
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
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
  C1_PROTECTION_MODE: "trusted-source",
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
      return { preReceipt: 456 };
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
    denial: async () => { log.push("application-denial"); },
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
  assert.equal(r.hosted, "TEST_PHASE_COMPLETE_PENDING_POST");
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
    assert.notEqual(r.hosted, "TEST_PHASE_COMPLETE_PENDING_POST");
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
test("explicit automation mode preserves admission-before-passwords and real A/B session sequence", async () => {
  const log = [], d = adapters(log), secret = "SYNTHETIC_BYPASS_VALUE_123456789";
  d.protection = async () => { log.push("protection-without-credential"); };
  d.transport = (admission) => {
    assert.equal(scopedHeaders(manifest.origin + "/", admission)["x-vercel-protection-bypass"], secret);
    assert(!JSON.stringify(admission).includes(secret));
    return () => {};
  };
  const r = await executeAcceptance({ ...env, C1_PROTECTION_MODE:"automation-bypass", C1_AUTOMATION_BYPASS_SECRET:secret }, {enabled:true}, d);
  assert.equal(r.hosted, "TEST_PHASE_COMPLETE_PENDING_POST");
  assert.equal(r.protectionMode, "automation-bypass");
  assert(log.indexOf("application-denial") < log.indexOf("login-A"));
  assert(log.indexOf("protection-without-credential") < log.indexOf("login-A"));
  assert.deepEqual(log.filter(x => x.startsWith("login-")), ["login-A", "login-B"]);
  assert(!JSON.stringify(r).includes(secret));
});
test("missing A/B passwords, missing bypass or failed GitHub OIDC cannot be silently replaced by transport admission", async () => {
  const secret = "SYNTHETIC_BYPASS_VALUE_123456789";
  for (const absent of ["C1_ACCOUNT_A_PASSWORD", "C1_ACCOUNT_B_PASSWORD", "C1_AUTOMATION_BYPASS_SECRET", "C1_PROTECTION_MODE"]) {
    const log = [], d = adapters(log), configured = {...env, C1_PROTECTION_MODE:"automation-bypass", C1_AUTOMATION_BYPASS_SECRET:secret};
    d.protection = async () => {};
    delete configured[absent];
    const r = await executeAcceptance(configured, {enabled:true}, d);
    assert.equal(r.gate, "BLOCK");
    assert(!log.some(x => x.startsWith("login-")));
  }
  const log = [], d = adapters(log), configured = {...env, C1_PROTECTION_MODE:"automation-bypass"};
  d.protection = async () => {};
  d.oidc = async () => { throw Error(secret); };
  Object.defineProperty(configured, "C1_AUTOMATION_BYPASS_SECRET", {get(){throw Error("bypass-read-before-verified-oidc");}});
  const r = await executeAcceptance(configured, {enabled:true}, d);
  assert.equal(r.hosted, "NOT_RUN");
  assert(!JSON.stringify(r).includes(secret));
  assert(!log.includes("public-config"));
});
