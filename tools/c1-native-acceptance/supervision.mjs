import { createHash } from "node:crypto";
import {
  manifest,
  check,
  guardIdentity,
  identityFromEnv,
  rows,
  report,
} from "./policy.mjs";
import { githubGet } from "./preflight.mjs";
const root = "/repos/" + manifest.repository;
export const digest = (text) => createHash("sha256").update(text).digest("hex");
function exact(value, keys) {
  check(value && typeof value === "object" && !Array.isArray(value));
  check(Object.keys(value).sort().join() === keys.slice().sort().join());
}
function immutable(origin) {
  const u = new URL(origin);
  check(
    u.origin === origin &&
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password &&
      u.hostname.length <= 253 &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(u.hostname) &&
      !u.hostname.includes("-git-") &&
      u.hostname !== "life-rhythm-prototype.vercel.app",
  );
}
export function supervisionConfig(c, target = manifest) {
  exact(c, [
    "enabled",
    "immutableOriginApproved",
    "immutableOrigin",
    "trustedObserverIds",
    "preEnvironmentId",
    "postEnvironmentId",
  ]);
  check(
    c?.enabled === true &&
      c.immutableOriginApproved === true &&
      c.immutableOrigin === target.origin,
  );
  immutable(target.origin);
  check(
    Array.isArray(c.trustedObserverIds) &&
      c.trustedObserverIds.length > 0 &&
      c.trustedObserverIds.length <= 4 &&
      new Set(c.trustedObserverIds).size === c.trustedObserverIds.length,
  );
  check(
    c.trustedObserverIds.every(
      (x) => typeof x === "string" && /^[1-9][0-9]{0,15}$/.test(x),
    ),
  );
  check(
    Number.isSafeInteger(c.preEnvironmentId) &&
      c.preEnvironmentId > 0 &&
      Number.isSafeInteger(c.postEnvironmentId) &&
      c.postEnvironmentId > 0 &&
      c.preEnvironmentId !== c.postEnvironmentId,
  );
}
export function verifyRecord(
  record,
  env,
  target,
  phase,
  now = Date.now(),
  pending,
) {
  const expected = {
    format: 2,
    phase,
    repository: manifest.repository,
    repositoryId: manifest.repositoryId,
    ownerId: manifest.ownerId,
    runId: env.GITHUB_RUN_ID,
    attempt: "1",
    harness: env.C1_TRUSTED_SHA,
    source: target.source,
    deployment: target.deployment,
    project: manifest.project,
    team: manifest.team,
    origin: target.origin,
    environment: "preview",
    state: "READY",
    observationMethod: "VERCEL_EXISTING_CONNECTION_METADATA",
  };
  check(
    ["pre", "post"].includes(phase) &&
      /^[1-9][0-9]{0,15}$/.test(env.GITHUB_RUN_ID) &&
      env.GITHUB_RUN_ATTEMPT === "1" &&
      /^[a-f0-9]{40}$/.test(env.C1_TRUSTED_SHA),
  );
  immutable(target.origin);
  if (phase === "post") {
    check(pending);
    Object.assign(expected, {
      phaseDigest: pending.phaseDigest,
      preReceipt: pending.preReceipt,
      completedAt: pending.completedAt,
    });
  }
  exact(record, [...Object.keys(expected), "observedAt"]);
  for (const [k, v] of Object.entries(expected)) check(record[k] === v);
  const observed = Date.parse(record.observedAt);
  check(
    Number.isFinite(observed) &&
      new Date(observed).toISOString() === record.observedAt &&
      observed <= now + 2000 &&
      observed >= now - (phase === "pre" ? 20 : 5) * 60000,
  );
  if (phase === "post") check(observed >= Date.parse(pending.completedAt));
  return observed;
}
export async function verifySupervision(
  env,
  config,
  phase,
  get = githubGet,
  target = manifest,
  pending,
) {
  supervisionConfig(config, target);
  const runId = env.GITHUB_RUN_ID;
  check(/^[1-9][0-9]{0,15}$/.test(runId) && env.GITHUB_RUN_ATTEMPT === "1");
  const run = await get(root + "/actions/runs/" + runId);
  check(
    run.id === Number(runId) &&
      run.run_attempt === 1 &&
      run.head_sha === env.C1_TRUSTED_SHA &&
      run.head_branch === "main" &&
      run.event === "workflow_dispatch" &&
      run.path === ".github/workflows/c1-native-acceptance.yml" &&
      run.repository?.id === Number(manifest.repositoryId) &&
      run.repository.full_name === manifest.repository,
  );
  const reviews = await get(root + "/actions/runs/" + runId + "/approvals");
  check(Array.isArray(reviews) && reviews.length > 0 && reviews.length < 50);
  const name =
      phase === "pre" ? "c1-native-preview" : "c1-native-post-verification",
    id = phase === "pre" ? config.preEnvironmentId : config.postEnvironmentId;
  const relevant = reviews.filter((r) =>
    r.environments?.some((e) => e.id === id && e.name === name),
  );
  check(relevant.length === 1);
  const review = relevant[0];
  check(
    review.state === "approved" &&
      review.user?.type === "User" &&
      config.trustedObserverIds.includes(String(review.user.id)) &&
      review.user.id !== run.actor?.id &&
      review.user.id !== run.triggering_actor?.id,
  );
  const match = /^C1_RECEIPT ([1-9][0-9]{0,15}) ([a-f0-9]{64})$/.exec(
    review.comment,
  );
  check(match);
  const receipt = await get(root + "/issues/comments/" + match[1]);
  check(
    receipt.id === Number(match[1]) &&
      receipt.user?.id === review.user.id &&
      receipt.user.type === "User" &&
      receipt.issue_url === "https://api.github.com" + root + "/issues/181" &&
      [
        "https://github.com/" +
          manifest.repository +
          "/issues/181#issuecomment-" +
          match[1],
        "https://github.com/" +
          manifest.repository +
          "/pull/181#issuecomment-" +
          match[1],
      ].includes(receipt.html_url),
  );
  check(
    typeof receipt.body === "string" &&
      Buffer.byteLength(receipt.body) <= 8192 &&
      digest(receipt.body) === match[2] &&
      receipt.created_at === receipt.updated_at,
  );
  const now = Date.now(),
    created = Date.parse(receipt.created_at),
    record = JSON.parse(receipt.body);
  check(
    Number.isFinite(created) &&
      created <= now + 2000 &&
      created >= now - (phase === "pre" ? 20 : 5) * 60000,
  );
  check(receipt.body === JSON.stringify(record)); // compact canonical JSON, rejects duplicate keys
  const observed = verifyRecord(record, env, target, phase, now, pending);
  check(observed <= created + 2000 && observed >= created - 30000);
  if (phase === "post")
    check(
      created >= Date.parse(pending.completedAt) &&
        receipt.id !== pending.preReceipt,
    );
  return {
    verified: true,
    preReceipt: phase === "pre" ? receipt.id : pending.preReceipt,
    receipt: receipt.id,
  };
}
// Result bytes come only from the reviewed native job's needs outputs, never a
// workflow input or uploaded observation. Post observer endorses the same digest.
export function phaseResult(result, target = manifest) {
  immutable(target.origin);
  check(
    result.gate === "BLOCK" &&
      /^[1-9][0-9]{0,15}$/.test(result.runId) &&
      result.attempt === "1" &&
      /^[a-f0-9]{40}$/.test(result.harness) &&
      result.source === target.source &&
      result.deployment === target.deployment &&
      result.origin === target.origin &&
      Number.isSafeInteger(result.preReceipt) &&
      result.preReceipt > 0 &&
      typeof result.completedAt === "string" &&
      new Date(Date.parse(result.completedAt)).toISOString() ===
        result.completedAt,
  );
  check(
    result.hosted === "TEST_PHASE_COMPLETE_PENDING_POST" &&
      rows.every((row) => result.passed.includes(row)),
  );
  const selected = {
    format: 2,
    gate: "BLOCK",
    hosted: result.hosted,
    runId: result.runId,
    attempt: result.attempt,
    harness: result.harness,
    source: result.source,
    deployment: result.deployment,
    origin: result.origin,
    preReceipt: result.preReceipt,
    completedAt: result.completedAt,
    passed: [...rows],
    requests: result.requests,
    passwordSignins: result.passwordSignins,
  };
  check(
    Number.isInteger(selected.requests) &&
      selected.requests >= 0 &&
      selected.requests <= 200 &&
      Number.isInteger(selected.passwordSignins) &&
      selected.passwordSignins >= 0 &&
      selected.passwordSignins <= 8,
  );
  return selected;
}
export function verifyPending(pending, job, env, target = manifest) {
  exact(pending, [
    "format",
    "gate",
    "hosted",
    "runId",
    "attempt",
    "harness",
    "source",
    "deployment",
    "origin",
    "preReceipt",
    "completedAt",
    "passed",
    "requests",
    "passwordSignins",
    "phaseDigest",
  ]);
  check(
    pending.format === 2 &&
      Array.isArray(pending.passed) &&
      pending.passed.length === rows.length &&
      rows.every((row) => pending.passed.includes(row)) &&
      new Set(pending.passed).size === rows.length,
  );
  check(
    Number.isInteger(pending.requests) &&
      pending.requests >= 0 &&
      pending.requests <= 200 &&
      Number.isInteger(pending.passwordSignins) &&
      pending.passwordSignins >= 0 &&
      pending.passwordSignins <= 8,
  );
  check(
    pending?.hosted === "TEST_PHASE_COMPLETE_PENDING_POST" &&
      pending.gate === "BLOCK" &&
      pending.runId === env.GITHUB_RUN_ID &&
      pending.attempt === "1" &&
      pending.harness === env.C1_TRUSTED_SHA &&
      pending.source === target.source &&
      pending.deployment === target.deployment &&
      pending.origin === target.origin &&
      Number.isSafeInteger(pending.preReceipt) &&
      pending.preReceipt > 0,
  );
  check(
    job.id === Number(env.C1_NATIVE_JOB_ID) &&
      job.run_id === Number(env.GITHUB_RUN_ID) &&
      job.run_attempt === 1 &&
      job.head_sha === env.C1_TRUSTED_SHA &&
      job.name === "C1 native test phase" &&
      job.status === "completed" &&
      job.conclusion === "success",
  );
  check(
    Number.isFinite(Date.parse(pending.completedAt)) &&
      Date.parse(pending.completedAt) >= Date.parse(job.started_at) &&
      Date.parse(pending.completedAt) <= Date.parse(job.completed_at),
  );
  check(
    pending.phaseDigest === env.C1_PHASE_DIGEST &&
      /^[a-f0-9]{64}$/.test(pending.phaseDigest),
  );
  return pending;
}
export async function postVerification(
  env,
  config,
  get = githubGet,
  target = manifest,
) {
  supervisionConfig(config, target);
  guardIdentity(identityFromEnv(env), env.C1_TRUSTED_SHA);
  check(
    typeof env.C1_PHASE_RESULT_B64 === "string" &&
      env.C1_PHASE_RESULT_B64.length < 32768 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(env.C1_PHASE_RESULT_B64),
  );
  const text = Buffer.from(env.C1_PHASE_RESULT_B64, "base64").toString("utf8");
  check(digest(text) === env.C1_PHASE_DIGEST);
  const pending = JSON.parse(text);
  check(!Object.hasOwn(pending, "phaseDigest"));
  pending.phaseDigest = env.C1_PHASE_DIGEST;
  check(/^[1-9][0-9]{0,15}$/.test(env.C1_NATIVE_JOB_ID));
  const job = await get(root + "/actions/jobs/" + env.C1_NATIVE_JOB_ID);
  verifyPending(pending, job, env, target);
  // Observation must follow GitHub-confirmed native job completion, not merely
  // the earlier runner-generated completion timestamp.
  const observedPending = { ...pending, completedAt: job.completed_at };
  await verifySupervision(env, config, "post", get, target, observedPending);
  return {
    format: 2,
    gate: "BLOCK",
    hosted: "SCOPED_ROWS_COMPLETE",
    runId: env.GITHUB_RUN_ID,
    attempt: "1",
    harness: env.C1_TRUSTED_SHA,
    source: manifest.source,
    deployment: manifest.deployment,
    preReceipt: pending.preReceipt,
    phaseDigest: env.C1_PHASE_DIGEST,
    postVerification: "VERIFIED_SUPERVISED",
    fixturesNotRun: report().fixturesNotRun,
    historicalIdentityEvidence: "UNCHANGED",
  };
}
