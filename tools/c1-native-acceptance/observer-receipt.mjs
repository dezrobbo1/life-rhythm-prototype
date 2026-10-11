import { manifest, check } from "./policy.mjs";
import { verifyRecord, verifyPending, fixtureStages } from "./supervision.mjs";

// Pure projection for an owner-authorized external Work executor. This module
// performs no provider request and does not prove a lookup occurred. The
// authenticated GitHub comment author remains accountable for the real fresh
// Gmail-linked connector lookup described in automated-observer-contract.md.
// Never pass provider credentials, raw responses or exceptions to publication.
export function connectorReceipt(deployment, context, env, phase,
  target = manifest, pending, nativeJob) {
  check(context?.accountEmail === "dezrobbo1@gmail.com" &&
    context.teamId === manifest.team && context.requestedDeployment === target.deployment);
  check(deployment?.id === target.deployment &&
    deployment.url === new URL(target.origin).hostname &&
    deployment.project?.id === manifest.project &&
    deployment.readyState === "READY" && deployment.target === null &&
    deployment.source === "git" && deployment.meta?.githubCommitSha === target.source);
  let completedAt;
  const verifyCleanup=()=>check(context.exactKeyRevoked===true && context.environmentSecretRemoved===true &&
    context.bypassInventoryEmpty===true && context.deploymentsUnchanged===true);
  if (phase === "post") {
    check(pending && nativeJob);
    verifyPending(pending, nativeJob, env, target);
    completedAt = nativeJob.completed_at;
    check(context.fixtureProject==="lfwadowwdvcnibjkeerg" && context.fixtureVerified===true && context.baselineDigest===pending.fixtures.baselineDigest);
    if(pending.protectionMode==="automation-bypass") verifyCleanup();
  }
  const record = {
    format: 3, phase, repository: manifest.repository,
    repositoryId: manifest.repositoryId, ownerId: manifest.ownerId,
    runId: env.GITHUB_RUN_ID, attempt: "1", harness: env.C1_TRUSTED_SHA,
    source: target.source, deployment: target.deployment,
    project: manifest.project, team: manifest.team, origin: target.origin,
    environment: "preview", state: "READY",
    observationMethod: "VERCEL_EXISTING_CONNECTION_METADATA",
    observerTrust: "OWNER_AUTHORIZED_EXTERNAL_CONNECTOR",
    observedAt: new Date().toISOString(),
    ...(phase === "post" ? { phaseDigest: pending.phaseDigest,
      preReceipt: pending.preReceipt, completedAt,fixtureBaselineDigest:pending.fixtures.baselineDigest,
      fixtureRestoredReceipt:pending.fixtures.fixtureRestoredReceipt,
      ...(pending.protectionMode==="automation-bypass"?{
        bypassRevocationReceipt:pending.bypassCleanup.revocationReceipt,bypassCleanupVerified:true}:{}),
    } : {}),
  };
  if(fixtureStages.includes(phase)) {
    check(context.fixtureProject === "lfwadowwdvcnibjkeerg" && context.fixtureState === phase && context.fixtureVerified === true && /^[a-f0-9]{64}$/.test(context.baselineDigest));
    Object.assign(record,{baselineDigest:context.baselineDigest,preReceipt:Number(env.C1_PRE_RECEIPT_ID),fixtureObservationMethod:"SUPABASE_EXISTING_CONNECTION_METADATA"});
  }
  if(phase==="bypass-revoked") {
    verifyCleanup();
    Object.assign(record,{preReceipt:Number(env.C1_PRE_RECEIPT_ID),revokedAt:context.revokedAt,
      revocationMethod:"VERCEL_EXISTING_CONNECTION_EXACT_KEY_REVOCATION",
      environmentSecretRemoved:true,bypassInventoryEmpty:true,deploymentsUnchanged:true});
  }
  verifyRecord(record, env, target, phase, Date.now(), phase === "post"
    ? { ...pending, completedAt } : fixtureStages.includes(phase)||phase==="bypass-revoked" ? pending : undefined, "external-connector-automation");
  return record;
}
