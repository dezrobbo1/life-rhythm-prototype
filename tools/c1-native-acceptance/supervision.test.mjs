import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  verifySupervision,
  verifyRecord,
  verifyPending,
  postVerification,
  digest,
  phaseResult,
} from "./supervision.mjs";
import { manifest, rows } from "./policy.mjs";
const sha = "a".repeat(40),
  origin =
    "https://life-rhythm-prototype-immutable123-daler-project-lr.vercel.app";
const env = {
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  C1_TRUSTED_SHA: sha,
  C1_PROTECTION_MODE: "trusted-source",
};
const target = { ...manifest, origin };
const config = {
  enabled: true,
  immutableOriginApproved: true,
  immutableOrigin: origin,
  trustedObserverIds: ["777"],
  preEnvironmentId: 101,
  postEnvironmentId: 102,
};
const run = {
  id: 123,
  run_attempt: 1,
  head_sha: sha,
  head_branch: "main",
  event: "workflow_dispatch",
  path: ".github/workflows/c1-native-acceptance.yml",
  repository: {
    id: Number(manifest.repositoryId),
    full_name: manifest.repository,
  },
  actor: { id: 888 },
  triggering_actor: { id: 888 },
};
function record(phase = "pre", now = Date.now(), pending) {
  return {
    format: 2,
    phase,
    repository: manifest.repository,
    repositoryId: manifest.repositoryId,
    ownerId: manifest.ownerId,
    runId: "123",
    attempt: "1",
    harness: sha,
    source: manifest.source,
    deployment: manifest.deployment,
    project: manifest.project,
    team: manifest.team,
    origin,
    environment: "preview",
    state: "READY",
    observedAt: new Date(now - 1000).toISOString(),
    observationMethod: "VERCEL_EXISTING_CONNECTION_METADATA",
    ...(phase === "post"
      ? {
          phaseDigest: pending.phaseDigest,
          preReceipt: pending.preReceipt,
          completedAt: pending.completedAt,
          fixtureBaselineDigest:pending.fixtures.baselineDigest,
          fixtureRestoredReceipt:pending.fixtures.fixtureRestoredReceipt,
        }
      : {}),
  };
}
function fixture(phase = "pre", pending) {
  const now = Date.now(),
    body = JSON.stringify(record(phase, now, pending));
  const hash = createHash("sha256").update(body).digest("hex");
  const receiptId = phase === "pre" ? 456 : 457;
  const receipt = {
    id: receiptId,
    user: { id: 777, type: "User" },
    body,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    issue_url:
      "https://api.github.com/repos/" + manifest.repository + "/issues/181",
    html_url:
      "https://github.com/" +
      manifest.repository +
      "/issues/181#issuecomment-" +
      receiptId,
  };
  const approval = {
    state: "approved",
    user: { id: 777, type: "User" },
    environments: [
      {
        id: phase === "pre" ? 101 : 102,
        name:
          phase === "pre" ? "c1-native-preview" : "c1-native-post-verification",
      },
    ],
    comment: "C1_RECEIPT " + receiptId + " " + hash,
  };
  const currentRun = structuredClone(run);
  return {
    receipt,
    approval,
    run: currentRun,
    get: async (p) =>
      p.endsWith("/approvals")
        ? [approval]
        : p.includes("/issues/comments/")
          ? receipt
          : currentRun,
  };
}
test("trusted GitHub approval plus immutable unedited exact-run receipt admits pre observation", async () => {
  const f = fixture();
  const result = await verifySupervision(env, config, "pre", f.get, target);
  assert.equal(result.preReceipt, 456);
});
test("arbitrary JSON, wrong author, edits, replay, stale observations, source/harness/origin drift fail", async () => {
  for (const mutate of [
    (f) => (f.receipt.user.id = 999),
    (f) => (f.approval.user.id = 999),
    (f) => (f.approval.state = "rejected"),
    (f) => (f.run.actor.id = 777),
    (f) => (f.run.run_attempt = 2),
    (f) => (f.run.head_sha = "b".repeat(40)),
    (f) => (f.receipt.updated_at = new Date(Date.now() + 1000).toISOString()),
    (f) =>
      (f.receipt.created_at = new Date(Date.now() - 1201000).toISOString()),
    (f) => (f.receipt.issue_url += "evil"),
    (f) => (f.approval.environments[0].id = 999),
    (f) => (f.approval.comment = "{}"),
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(verifySupervision(env, config, "pre", f.get, target));
  }
});
test("every target/run field is bound and unknown payload fields rejected", () => {
  const now = Date.now();
  const good = record("pre", now);
  verifyRecord(good, env, target, "pre", now);
  for (const k of [
    "repository",
    "repositoryId",
    "ownerId",
    "runId",
    "attempt",
    "harness",
    "source",
    "deployment",
    "project",
    "team",
    "origin",
    "environment",
    "state",
    "observationMethod",
  ])
    assert.throws(() =>
      verifyRecord({ ...good, [k]: "wrong" }, env, target, "pre", now),
    );
  assert.throws(() =>
    verifyRecord({ ...good, password: "synthetic" }, env, target, "pre", now),
  );
  assert.throws(() =>
    verifyRecord(
      { ...good, observedAt: new Date(now - 1201000).toISOString() },
      env,
      target,
      "pre",
      now,
    ),
  );
});
test("post observation must follow completion and bind exact phase evidence digest and pre receipt", async () => {
  const pending = {
    format: 2,
    gate: "BLOCK",
    hosted: "TEST_PHASE_COMPLETE_PENDING_POST",
    runId: "123",
    attempt: "1",
    harness: sha,
    source: manifest.source,
    deployment: manifest.deployment,
    origin,
    preReceipt: 456,
    fixtures: {baselineDigest:"d".repeat(64),baselineReceipt:458,fixtureRestoredReceipt:459},
    completedAt: new Date(Date.now() - 5000).toISOString(),
    phaseDigest: "d".repeat(64),
  };
  const f = fixture("post", pending);
  assert.equal(
    (await verifySupervision(env, config, "post", f.get, target, pending))
      .verified,
    true,
  );
  for (const patch of [
    { phaseDigest: "e".repeat(64) },
    { preReceipt: 999 },
    { completedAt: new Date(Date.now()).toISOString() },
  ]) {
    const bad = { ...pending, ...patch };
    await assert.rejects(
      verifySupervision(env, config, "post", f.get, target, bad),
    );
  }
});
test("uploaded output cannot become trusted phase evidence without exact native-job provenance", () => {
  assert.throws(() => verifyPending({}, {}, env, target));
});

test("post finalization requires the actual successful native job and trusted observation of its exact digest", async () => {
  const completedAt = new Date(Date.now() - 5000).toISOString(),
    jobDone = new Date(Date.now() - 4000).toISOString();
  const phase = {
    format: 2,
    gate: "BLOCK",
    hosted: "TEST_PHASE_COMPLETE_PENDING_POST",
    runId: "123",
    attempt: "1",
    harness: sha,
    source: manifest.source,
    deployment: manifest.deployment,
    origin,
    preReceipt: 456,
    fixtures: {baselineDigest:"d".repeat(64),baselineReceipt:458,fixtureRestoredReceipt:459},
    completedAt,
    passed: [...rows],
    requests: 100,
    passwordSignins: 5,
    protectionMode: "trusted-source",
  };
  const text = JSON.stringify(phase),
    hash = digest(text),
    pending = { ...phase, phaseDigest: hash, completedAt: jobDone };
  const identity = {
    ...env,
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
    C1_PHASE_RESULT_B64: Buffer.from(text).toString("base64"),
    C1_PHASE_DIGEST: hash,
    C1_NATIVE_JOB_ID: "789",
  };
  const job = {
    id: 789,
    run_id: 123,
    run_attempt: 1,
    head_sha: sha,
    name: "C1 native test phase",
    status: "completed",
    conclusion: "success",
    started_at: new Date(Date.now() - 10000).toISOString(),
    completed_at: jobDone,
  };
  const externalConfig={enabled:true,immutableOriginApproved:true,immutableOrigin:origin,
    mode:"external-connector-automation",receiptIssue:179,trustedObserverIds:[manifest.ownerId]};
  const receipt=(phase,id,extra)=>{const now=Date.now();return{id,user:{id:Number(manifest.ownerId),type:"User"},
    body:JSON.stringify({...record(phase,now,phase==="post"?pending:undefined),format:3,
      observerTrust:"OWNER_AUTHORIZED_EXTERNAL_CONNECTOR",...extra}),
    created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString(),
    issue_url:"https://api.github.com/repos/"+manifest.repository+"/issues/179",
    html_url:"https://github.com/"+manifest.repository+"/issues/179#issuecomment-"+id};};
  const post=receipt("post",457,{}), restored=receipt("fixture-restored",459,
    {baselineDigest:pending.fixtures.baselineDigest,preReceipt:456,
     fixtureObservationMethod:"SUPABASE_EXISTING_CONNECTION_METADATA"});
  const f={get:async path=>path.includes("/issues/179/comments")?[post,restored]:
    path.endsWith("/issues/comments/459")?restored:path.endsWith("/issues/comments/457")?post:run};
  const reader=async path=>path.includes("/actions/jobs/")?job:f.get(path);
  const result = await postVerification(identity, externalConfig, reader, target);
  assert.equal(result.hosted, "C1_ACCEPTED");
  assert.equal(result.gate, "PASS");
  for (const patch of [
    { conclusion: "failure" },
    { run_attempt: 2 },
    { head_sha: "b".repeat(40) },
    { id: 999 },
    { run_id: 999 },
    { name: "other job" },
    { completed_at: new Date(Date.now() - 6000).toISOString() },
  ])
    await assert.rejects(
      postVerification(
        identity,
        externalConfig,
        async (path) =>
          path.includes("/actions/jobs/") ? { ...job, ...patch } : f.get(path),
        target,
      ),
    );
  for (const patch of [
    { C1_PHASE_DIGEST: "e".repeat(64) },
    {
      C1_PHASE_RESULT_B64: Buffer.from(
        JSON.stringify({ ...phase, password: "synthetic-secret" }),
      ).toString("base64"),
    },
  ])
    await assert.rejects(
      postVerification({ ...identity, ...patch }, externalConfig, reader, target),
    );
});
test("trusted receipt fields still fail when attacker recomputes the public digest", async () => {
  for (const patch of [
    { source: "b".repeat(40) },
    { harness: "b".repeat(40) },
    { origin: manifest.origin },
    { runId: "999" },
    { attempt: "2" },
    { observedAt: new Date(Date.now() + 60000).toISOString() },
    { password: "synthetic-secret" },
  ]) {
    const f = fixture();
    const record = JSON.parse(f.receipt.body);
    f.receipt.body = JSON.stringify({ ...record, ...patch });
    f.approval.comment =
      "C1_RECEIPT " + f.receipt.id + " " + digest(f.receipt.body);
    await assert.rejects(verifySupervision(env, config, "pre", f.get, target));
  }
});

test("phase output projection drops arbitrary secrets and rejects unbound source/run fields", () => {
  const phase = {
    format: 2,
    gate: "BLOCK",
    hosted: "TEST_PHASE_COMPLETE_PENDING_POST",
    runId: "123",
    attempt: "1",
    harness: sha,
    source: target.source,
    deployment: target.deployment,
    origin,
    preReceipt: 456,
    fixtures: {baselineDigest:"d".repeat(64),baselineReceipt:458,fixtureRestoredReceipt:459},
    completedAt: new Date().toISOString(),
    passed: [...rows],
    requests: 100,
    passwordSignins: 5,
    protectionMode: "trusted-source",
    password: "SYNTHETIC_SECRET",
  };
  assert(
    !JSON.stringify(phaseResult(phase, target)).includes("SYNTHETIC_SECRET"),
  );
  for (const patch of [
    { source: "wrong" },
    { runId: "SYNTHETIC_SECRET" },
    { harness: "wrong" },
    { preReceipt: null },
    { origin: manifest.origin },
    { attempt: "2" },
    { requests: 201 },
    { passwordSignins: 9 },
  ])
    assert.throws(() => phaseResult({ ...phase, ...patch }, target));
});
test("duplicate record keys cannot hide conflicting values behind the approved digest", async () => {
  const f = fixture();
  f.receipt.body = f.receipt.body.replace("{", '{"source":"wrong",');
  f.approval.comment =
    "C1_RECEIPT " + f.receipt.id + " " + digest(f.receipt.body);
  await assert.rejects(verifySupervision(env, config, "pre", f.get, target));
});
