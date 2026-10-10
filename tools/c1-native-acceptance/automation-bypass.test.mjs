import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as policy from "./policy.mjs";
import { makeTransport } from "./native.mjs";
import { publicTextReader } from "./admission.mjs";
import { executeAcceptance } from "./orchestrator.mjs";
import { phaseResult } from "./supervision.mjs";

const secret = "SYNTHETIC_BYPASS_VALUE_123456789";
const path = "/api/account/boundary?protocolVersion=1&schemaVersion=1";
const credential = () => {
  assert.equal(typeof policy.protectionCredential, "function");
  return policy.protectionCredential("automation-bypass", secret);
};
test("bypass headers bind HTTPS and exact immutable host; wrong host and aliases fail before fetch", async () => {
  const admission = credential();
  assert.deepEqual(policy.scopedHeaders(policy.manifest.origin + path, admission), {
    "x-vercel-protection-bypass": secret, Origin: policy.manifest.origin,
  });
  let calls = 0;
  const tx = makeTransport(admission, new policy.Budget(), async () => { calls++; });
  for (const url of [
    "https://unrelated.vercel.app" + path,
    "https://life-rhythm-prototype.vercel.app" + path,
    "https://life-rhythm-prototype-git-main-daler-project-lr.vercel.app" + path,
    policy.manifest.origin.replace("https:", "http:") + path,
    policy.manifest.origin + ":444" + path,
  ]) await assert.rejects(tx(url));
  assert.equal(calls, 0);
});
test("bypass never travels to Supabase or through caller cookies/arbitrary protection headers", () => {
  const admission = credential();
  const headers = policy.scopedHeaders(policy.manifest.provider + "/auth/v1/user", admission, {
    Authorization: "Bearer synthetic-session", Cookie: secret,
    "X-Vercel-Protection-Bypass": secret, "X-Vercel-Trusted-Oidc-Idp-Token": secret,
  });
  assert.deepEqual(headers, { Authorization: "Bearer synthetic-session" });
  assert.throws(() => policy.scopedHeaders("https://api.github.com/", admission));
});
test("API and public bootstrap reject redirects without forwarding admission", async () => {
  const admission = credential();
  let calls = 0;
  const fetcher = async (url, init) => {
    calls++;
    assert.equal(url, policy.manifest.origin + path);
    assert.equal(init.redirect, "error");
    return new Response(null, { status: 302, headers: { Location: "https://unrelated.vercel.app/" } });
  };
  await assert.rejects(makeTransport(admission, new policy.Budget(), fetcher)(policy.manifest.origin + path));
  assert.equal(calls, 1);
  await assert.rejects(publicTextReader(admission, new policy.Budget(), async (url, init) => {
    assert.equal(init.redirect, "error");
    return new Response("", { status: 302, headers: { Location: "/" } });
  })(policy.manifest.origin + "/"));
});
test("opaque admission serializes and inspects only its mode, never the value", () => {
  const admission = credential();
  for (const output of [JSON.stringify(admission), inspect(admission), String(admission), JSON.stringify(policy.report())]) {
    assert(!output.includes(secret));
  }
  assert.deepEqual(Object.keys(admission), ["mode"]);
});
test("trusted-source remains usable; invalid or absent explicit mode never downgrades", () => {
  credential();
  for (const mode of [undefined, "", "auto", "trusted-source-failed"]) {
    assert.throws(() => policy.protectionCredential(mode, secret));
  }
  const oidc = policy.protectionCredential("trusted-source", "synthetic-verified-oidc");
  assert.deepEqual(policy.scopedHeaders(policy.manifest.origin + "/", oidc), {
    "x-vercel-trusted-oidc-idp-token": "synthetic-verified-oidc",
  });
  assert.throws(() => policy.protectionCredential("automation-bypass", ""));
});
test("Vercel-admitted application request without Supabase bearer must deny, not become identity", async () => {
  const admission = credential();
  assert.equal(typeof policy.proveApplicationDenial, "function");
  const denied = makeTransport(admission, new policy.Budget(), async (url, init) => {
    assert.equal(url, policy.manifest.origin + path);
    assert.equal(init.headers["x-vercel-protection-bypass"], secret);
    assert.equal(new Headers(init.headers).get("authorization"), null);
    return new Response(JSON.stringify({kind:"error", category:"unauthorized", requestId:"11111111-1111-4111-8111-111111111111"}), {
      status: 401, headers: { "content-type": "application/json", "cache-control": "private, no-store" },
    });
  });
  await policy.proveApplicationDenial(denied);
  await assert.rejects(policy.proveApplicationDenial(async () => ({response:new Response("{}"), body:{}})));
});
test("fallback wiring keeps both A/B Supabase sessions mandatory and carries no bypass in artifacts/logs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "c1-bypass-privacy-"));
  try {
    const result = spawnSync(process.execPath, [new URL("./run.mjs", import.meta.url).pathname], {
      cwd: dir, encoding: "utf8", env: { ...process.env, C1_AUTOMATION_BYPASS_SECRET: secret,
        C1_PROTECTION_MODE: "automation-bypass", C1_ENABLED: "false" },
    });
    assert.equal(result.status, 1);
    const evidence = await readFile(join(dir, "artifacts/results.json"), "utf8");
    for (const text of [result.stdout, result.stderr, evidence]) assert(!text.includes(secret));
    const source = await readFile(new URL("./orchestrator.mjs", import.meta.url), "utf8");
    assert.match(source, /protectionCredential/);
    assert.match(source, /proveApplicationDenial/);
    assert.match(source, /passwords\.every/);
    assert.match(source, /d\.login\(/);
    assert.match(source, /d\.refresh\(/);
  } finally { await rm(dir, {recursive:true, force:true}); }
});
test("workflow fallback is an explicit choice with a single environment secret reference after admission", async () => {
  const yaml = await readFile(new URL("../../.github/workflows/c1-native-acceptance.yml", import.meta.url), "utf8");
  assert.match(yaml, /protection_mode:/);
  assert.match(yaml, /type: choice/);
  assert.match(yaml, /- trusted-source/);
  assert.match(yaml, /- automation-bypass/);
  assert.equal([...yaml.matchAll(/secrets\.C1_AUTOMATION_BYPASS_SECRET/g)].length, 1);
  assert(yaml.indexOf("secrets.C1_AUTOMATION_BYPASS_SECRET") > yaml.indexOf("run.mjs --admission"));
  assert.match(yaml.slice(yaml.indexOf("  native:"), yaml.indexOf("  post-verification:")), /environment: c1-native-preview/);
});
test("external cleanup revokes once, removes the environment secret and verifies old admission fails", async () => {
  assert.equal(typeof policy.revokeAutomationBypass, "function");
  const calls = [];
  await policy.revokeAutomationBypass({
    revoke: async () => calls.push("revoke"),
    removeEnvironmentSecret: async () => calls.push("remove"),
    verifyDenied: async () => {calls.push("verify-denied"); return true;},
  });
  assert.deepEqual(calls, ["revoke", "remove", "verify-denied"]);
  await assert.rejects(policy.revokeAutomationBypass({
    revoke: async () => {throw Error(secret);},
    removeEnvironmentSecret: async () => calls.push("remove-after-failure"),
    verifyDenied: async () => false,
  }), {message:"C1_GUARD_BLOCK"});
  assert(calls.includes("remove-after-failure"));
});
test("admission proof checks exact Preview protection without sending any credential", async () => {
  assert.equal(typeof policy.proveDeploymentProtection, "function");
  await policy.proveDeploymentProtection(new policy.Budget(), async (url, init) => {
    assert.equal(url, policy.manifest.origin + "/");
    assert.equal(init.redirect, "manual");
    assert.deepEqual(init.headers, {});
    return new Response("protection", {status:401});
  });
  await assert.rejects(policy.proveDeploymentProtection(new policy.Budget(), async () => new Response("public app")));
});
test("uncredentialed protection proof recognizes only Vercel SSO redirects without following them", async () => {
  const location = "https://vercel.com/sso-api?url=" + encodeURIComponent(policy.manifest.origin + "/");
  await policy.proveDeploymentProtection(new policy.Budget(), async (url, init) => {
    assert.equal(url, policy.manifest.origin + "/");
    assert.equal(init.redirect, "manual");
    assert.deepEqual(init.headers, {});
    return new Response(null, { status: 302, headers: { location } });
  });
  for (const invalidLocation of [
    "https://other.invalid/sso-api", "https://vercel.com.evil.invalid/sso-api",
    "http://vercel.com/sso-api", "https://vercel.com/other",
    "https://user:password@vercel.com/sso-api", "/sso-api", "not a URL",
    "https://vercel.com/sso-api",
    "https://vercel.com/sso-api?url=https%3A%2F%2Funrelated.vercel.app%2F",
    location + "&url=" + encodeURIComponent(policy.manifest.origin + "/"),
    location + "&next=https%3A%2F%2Funrelated.invalid",
    location + "#fragment",
    location + "&nonce=one&nonce=two",
  ]) {
    await assert.rejects(policy.proveDeploymentProtection(new policy.Budget(), async () =>
      new Response(null, { status: 302, headers: { location: invalidLocation } })), { message: "C1_GUARD_BLOCK" });
  }
  await assert.rejects(policy.proveDeploymentProtection(new policy.Budget(), async () =>
    new Response(null, { status: 302 })));
});
test("phase artifact records only the explicit mode enum, never the bypass value", () => {
  const phase = { format:2, gate:"BLOCK", hosted:"TEST_PHASE_COMPLETE_PENDING_POST",
    runId:"123", attempt:"1", harness:"a".repeat(40), source:policy.manifest.source,
    deployment:policy.manifest.deployment, origin:policy.manifest.origin, preReceipt:456,
    fixtures:{baselineDigest:"d".repeat(64),baselineReceipt:458,fixtureRestoredReceipt:459},
    completedAt:new Date().toISOString(), passed:[...policy.rows], requests:100, passwordSignins:5,
    protectionMode:"automation-bypass", bypass:secret };
  const artifact = phaseResult(phase);
  assert.equal(artifact.protectionMode, "automation-bypass");
  assert(!JSON.stringify(artifact).includes(secret));
  assert.throws(() => phaseResult({...phase, protectionMode:secret}));
});
