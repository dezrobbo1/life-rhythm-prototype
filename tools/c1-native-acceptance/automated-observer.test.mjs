import { test } from "node:test";
import assert from "node:assert/strict";
import * as supervision from "./supervision.mjs";
import { manifest, rows } from "./policy.mjs";
import { verifyAttribution } from "./admission.mjs";

const harness = "a".repeat(40);
const origin = "https://life-rhythm-prototype-immutable123-daler-project-lr.vercel.app";
const target = { ...manifest, origin };
const config = {
  enabled: true, immutableOriginApproved: true, immutableOrigin: origin,
  mode: "external-connector-automation", trustedObserverIds: [manifest.ownerId],
  receiptIssue: 179,
};
const env = {
  GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", C1_TRUSTED_SHA: harness,
};
const now = Date.now();
function record(phase = "pre", pending) {
  return {
    format: 3, phase, repository: manifest.repository,
    repositoryId: manifest.repositoryId, ownerId: manifest.ownerId,
    runId: "123", attempt: "1", harness, source: target.source,
    deployment: target.deployment, project: target.project, team: target.team,
    origin, environment: "preview", state: "READY",
    observationMethod: "VERCEL_EXISTING_CONNECTION_METADATA",
    observerTrust: "OWNER_AUTHORIZED_EXTERNAL_CONNECTOR",
    observedAt: new Date(now - 1000).toISOString(),
    ...(phase === "post" ? { phaseDigest: pending.phaseDigest,
      preReceipt: pending.preReceipt, completedAt: pending.completedAt } : {}),
  };
}
function fixture(phase = "pre", pending) {
  const receipt = {
    id: phase === "pre" ? 456 : 457,
    user: { id: Number(manifest.ownerId), type: "User" },
    body: JSON.stringify(record(phase, pending)),
    created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
    issue_url: "https://api.github.com/repos/" + manifest.repository + "/issues/179",
    html_url: "https://github.com/" + manifest.repository + "/issues/179#issuecomment-" + (phase === "pre" ? 456 : 457),
  };
  const run = { id: 123, run_attempt: 1, head_sha: harness, head_branch: "main",
    event: "workflow_dispatch", path: ".github/workflows/c1-native-acceptance.yml",
    repository: { id: Number(manifest.repositoryId), full_name: manifest.repository },
    actor: { id: Number(manifest.ownerId) }, triggering_actor: { id: Number(manifest.ownerId) },
  };
  const preJob = { id: 654, run_id: 123, run_attempt: 1, head_sha: harness,
    name: "C1 external pre admission", status: "completed", conclusion: "success",
    started_at: new Date(now - 5000).toISOString(), completed_at: new Date(now + 1000).toISOString(),
  };
  const get = async path => {
    if (path.includes("/approvals")) throw Error("Human approval must not be requested");
    if (path.includes("/issues/179/comments")) return [receipt];
    if (path.includes("/issues/comments/")) return receipt;
    if (path.includes("/actions/jobs/")) return preJob;
    return run;
  };
  return { receipt, run, preJob, get };
}
test("external automation admits the actual owner author without pretending a second identity exists", async () => {
  const f = fixture();
  const got = await supervision.verifySupervision(env, config, "pre", f.get, target);
  assert.equal(got.preReceipt, 456);
  assert.equal(got.verified, true);
});
test("native admission requires the exact successful isolated pre job and needs-bound receipt digest", async () => {
  const f = fixture();
  const nativeEnv = { ...env, C1_PRE_JOB_ID: "654", C1_PRE_RECEIPT_ID: "456",
    C1_PRE_RECEIPT_DIGEST: supervision.digest(f.receipt.body) };
  assert.equal((await supervision.verifySupervision(nativeEnv, config, "pre", f.get, target)).verified, true);
  for (const mutate of [
    f => f.preJob.conclusion = "failure", f => f.preJob.run_id = 999,
    f => f.preJob.head_sha = "b".repeat(40), f => f.preJob.name = "C1 native test phase",
    f => f.preJob.run_attempt = 2, f => f.preJob.id = 999,
  ]) {
    const bad = fixture(); mutate(bad);
    await assert.rejects(supervision.verifySupervision(nativeEnv, config, "pre", bad.get, target));
  }
  await assert.rejects(supervision.verifySupervision({ ...nativeEnv, C1_PRE_RECEIPT_DIGEST: "f".repeat(64) }, config, "pre", f.get, target));
});
test("edited, forged, replayed, ambiguous and stale automated receipts cannot admit", async () => {
  for (const mutate of [
    f => f.receipt.user.id = 999, f => f.receipt.user.type = "Bot",
    f => f.receipt.updated_at = new Date(now + 5000).toISOString(),
    f => f.run.run_attempt = 2, f => f.run.head_sha = "b".repeat(40),
    f => f.receipt.issue_url += "evil",
    f => f.receipt.body = JSON.stringify({ ...record(), source: "b".repeat(40) }),
    f => f.receipt.body = JSON.stringify({ ...record(), observedAt: new Date(now - 1201000).toISOString() }),
    f => f.receipt.body = f.receipt.body.replace("{", '{"source":"wrong",'),
    f => f.receipt.body = JSON.stringify({ ...record(), password: "SYNTHETIC_SECRET" }),
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(supervision.verifySupervision(env, config, "pre", f.get, target));
  }
  const f = fixture();
  await assert.rejects(supervision.verifySupervision(env, config, "pre", async path =>
    path.includes("/issues/179/comments") ? [f.receipt, { ...f.receipt, id: 458 }] : f.get(path), target));
});
test("post observation is newer than native completion and endorses exact native output bytes", async () => {
  const pending = { phaseDigest: "d".repeat(64), preReceipt: 456,
    completedAt: new Date(now - 5000).toISOString() };
  const f = fixture("post", pending);
  assert.equal((await supervision.verifySupervision(env, config, "post", f.get, target, pending)).verified, true);
  for (const patch of [{ phaseDigest: "e".repeat(64) }, { preReceipt: 999 },
    { completedAt: new Date(now).toISOString() }])
    await assert.rejects(supervision.verifySupervision(env, config, "post", f.get, target, { ...pending, ...patch }));
});
test("receipt wait is bounded, never retries invalid receipts, and times out without admission", async () => {
  assert.equal(typeof supervision.waitForObservation, "function");
  let clock = now, calls = 0;
  await assert.rejects(supervision.waitForObservation(env, config, "pre", async path => {
    calls++; return path.includes("/comments") ? [] : fixture().run;
  }, target, undefined, { now: () => clock, wait: async ms => { clock += ms; }, timeoutMs: 50, intervalMs: 10 }));
  assert(calls <= 12);
  const bad = fixture(); bad.receipt.user.id = 999;
  let waits = 0;
  await assert.rejects(supervision.waitForObservation(env, config, "pre", bad.get, target, undefined,
    { now: () => now, wait: async () => { waits++; }, timeoutMs: 50, intervalMs: 10 }));
  assert.equal(waits, 0);
});
test("native observer interface never falls back to an unbound external comment", async () => {
  assert.equal(typeof supervision.verifyNativeObservation, "function");
  await assert.rejects(supervision.verifyNativeObservation(env, config, fixture().get, target));
});
test("orchestrator attribution interface preserves its phase argument and enforces pre-job binding", async () => {
  const f = fixture();
  const nativeEnv = { ...env, C1_PRE_JOB_ID: "654", C1_PRE_RECEIPT_ID: "456",
    C1_PRE_RECEIPT_DIGEST: supervision.digest(f.receipt.body) };
  assert.equal((await verifyAttribution(nativeEnv, config, "pre", f.get, target)).verified, true);
  await assert.rejects(verifyAttribution(nativeEnv, config, "post", f.get, target));
});
