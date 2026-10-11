# Runner-retained cleanup amendment — 2026-10-11

Approved scope: correct the failed execution-cell handoff from
[#179 comment 6105373849](https://github.com/dezrobbo1/life-rhythm-prototype/issues/179#issuecomment-6105373849).
Base `92122edf3a4e6be9917eb0bcfb3112387f636e53`; one writer, focused draft PR,
no merge or credentialed execution in this change. Application #180 and the exact
immutable target in final-native-coverage-contract.md remain unchanged. Only #180
was open at reconciliation; unpublished work in other chats cannot be ruled out.
No hosted acceptance PASS exists. Run 38051649607 failed before password sign-in;
its original HTTP cause remains unknown. #188 diagnostics remain intact.

## Bounded implementation plan and security boundary

- [x] Reproduce absent retained-key cleanup before correction.
- [x] Keep the supplied native-step bypass in its existing sealed memory carrier;
  remove the process-environment reference after verified OIDC and attribution.
  Reuse that SAME carrier through acceptance and cleanup; never export its value.
- [x] After unchanged acceptance and bounded session/browser cleanup, signal
  `C1_BYPASS_CLEANUP_WAIT` on both successful and failed attempts that loaded the key.
  Await a fresh external `bypass-revoked` receipt, never the dependent post job.
- [x] Complete at most two exact immutable Preview root GETs: old-key challenge,
  then ordinary credential-free protection check. Each is at most five seconds,
  no redirect following, cookies, response body recording or retry. Attempt the
  second once even if the first fails; request exhaustion/deadline prohibits it.
- [x] Require external revocation evidence plus both protection proofs before any
  automation-mode phase output can be published. Preserve C1 BLOCK pending post.
- [x] Complete offline verification and one independent focused security review,
  with one targeted correction verification; record source-only readiness in
  [runner-retained-cleanup-verification.json](runner-retained-cleanup-verification.json).
- [ ] BoB completes draft publication checks and a separate merge decision; no
  hosted run or C1 promotion is authorized by this source correction.

`retained-cleanup.mjs` owns this read-only wait/probe stage. It adds no provider
management credential or revocation power. The existing 19-minute absolute job
budget and 20-minute job timeout remain. Cleanup ends by the earlier of 110 seconds
from its start or five seconds before the absolute deadline. Receipt polling is at
most 90 seconds and leaves 20 seconds for probes/bookkeeping; cleanup requests share
the existing ten-request reserve and total 200-request cap. Ordinary acceptance
still stops two minutes before the deadline. There are no acceptance retries.

SIGINT/SIGTERM abort ordinary acceptance, retain BLOCK, and attempt this cleanup
under its separate strict deadline; cancellation cannot turn into PASS. Before key
load, admission failure stays BLOCK and the external operator must still revoke.
Deadline, cancellation, SIGKILL, runner loss, absent/invalid/edited/ambiguous evidence,
old-key admission or failed ordinary protection remain BLOCK. Operator revocation,
secret removal and fixture restoration are mandatory independently of runner logs,
results, job success, or whether post runs. No signal/post job is a cleanup watchdog.
Finally remove the sealed carrier's private association. JavaScript reference
release is not a claim of cryptographic memory erasure or provider revocation.

## External evidence

The existing authenticated external owner connector principal, receipt issue #179,
format-3 canonical bytes, unedited server timestamps, exact run/attempt/H/source/
deployment/project/team/origin and freshness checks remain mandatory. This is an
accountable external attestation, not a second human or a provider signature.

A new `bypass-revoked` receipt repeats those bindings and adds only `preReceipt`,
canonical `revokedAt`, `revocationMethod=VERCEL_EXISTING_CONNECTION_EXACT_KEY_REVOCATION`,
`environmentSecretRemoved=true`, `bypassInventoryEmpty=true`, and
`deploymentsUnchanged=true`. Actual exact-key revocation and fresh empty provider
inventory, GitHub secret-name absence, and frozen-window deployment comparison
must precede publication. Revocation/observation must follow the runner cleanup
request; invalid evidence fails immediately. No key value, key hash, raw provider
response or secret inventory values belong in the receipt. `connectorReceipt` is
only a strict projection; its booleans do not establish that management reads ran.

Native evidence adds exactly `bypassCleanup={revocationReceipt,requestedAt,verifiedAt,
oldKeyStatus,ordinaryStatus}` (statuses only 401/403 or the existing exact-host SSO
302 contract). Failure may leave this null; it never means external cleanup passed.
The native phase digest includes these fields; trusted-source mode uses null.
Independent post verification requires a completed successful exact native job,
original restoration receipt, unchanged authenticated revocation receipt observed
before the probe completion, and a NEW post receipt after GitHub job completion.
The post receipt binds `bypassRevocationReceipt` and `bypassCleanupVerified=true`;
the external operator must freshly verify provider/storage/deployment cleanup and
fixture restoration before endorsing the exact phase digest. Runner HTTP proofs
are supplementary to independent management evidence, never its replacement.

This amendment supersedes only the older external old-key HTTP challenge below:
the native runner now makes that challenge with the retained value. Exact-key
revocation remains external. A secure dashboard/operator route to revoke the sole
identified key without recovering it from native is an action-time prerequisite.
No key may be generated to investigate that route. The operator may use an existing
supported private management route; the runner never supplies the key to it.

# Final frozen-window provisioning amendment — 2026-10-10

For the final C1 window only, the owner supersedes the older isEnvVar=false
requirement below: Vercel requires its sole bypass to retain mandatory system-env
designation. The exact approved application Preview must already be READY before
creation. Create exactly one key, freeze ALL deployments/source operations, store
only in protected C1 environment, and revoke/remove immediately after evidence on
PASS or FAIL. If any deployment appears while live, revoke immediately and BLOCK.
Application source/client bundles must not consume/expose the key. No Production
request receives it. See [final-native-coverage-contract.md](final-native-coverage-contract.md).

Older provisioning restrictions below are historical; containment, explicit mode,
application-auth independence and privacy requirements remain in force.

---

# C1 explicit automation-bypass recovery — 2026-10-10

This is acceptance transport infrastructure, not C1 PASS. The owner authorized
temporary project-wide bypass authority after the exact Hobby project's Add
Bypass UI and current Vercel documentation established that a credential cannot
be limited server-side to Preview or one deployment. Its underlying authority
includes protected Production deployment URLs. The harness MUST NOT use it there.
No Production request, protection change, application credential, C2 or C3 is
authorized by this recovery. PR #180 application code is untouched.

The exact reviewed ten-claim Trusted Sources save returned 404, `Deployment
Protection Trusted Sources not found`, request
`syd1:sfo1::rq7cs-1791592989135-0301ef45a4a8`. GitHub namespace and historical project
link are healthy. Do not repeat reauthentication or silently downgrade a run.

## Transport and independent identity

Dispatch explicitly chooses `trusted-source` (default) or `automation-bypass`.
Missing/unknown mode fails closed. Both modes still issue and cryptographically
verify GitHub OIDC, including the reviewed full main SHA, environment and exact
claims; fallback does not replace workflow identity. The protected environment,
source/review/check preflight and fresh external pre/native/post observation
bindings remain required. Restored Trusted Sources can use the original path
with a newly reviewed H claim; runtime failure NEVER switches modes.

Only the native acceptance step can receive `C1_AUTOMATION_BYPASS_SECRET` from
`c1-native-preview`; only automation-bypass mode selects that secret. Preparation,
offline tests, admission-only and pre/post jobs receive no bypass. Use a fresh
32-character credential with note `Life Rhythm C1 acceptance`. No management
credential may be added to the workflow. Do not read/replace the A/B passwords.

The carrier uses a private WeakMap; JSON/inspection contains only the fixed mode
enum. `scopedHeaders` injects `x-vercel-protection-bypass` only on allowlisted
requests to the EXACT HTTPS immutable manifest origin. The independently observed
deployment ID/source/Preview target binds that hostname before secret access.
Do not add aliases, wildcard hosts, new assets or broader methods. Fetch uses
`redirect:error`; Playwright uses `maxRedirects:0`, rejects redirected requests
and never sets global extra headers, bypass cookies or URL query secrets.
Supabase receives only its own protocol fields and the real account session,
never the bypass. GitHub requests are a separate transport.

Automation mode first checks the exact Preview root without ANY credential and
requires protection (401/403). Public bootstrap with bypass then requires valid
app HTML/config from the same immutable origin. Before either password is read,
an admitted API request without a Supabase bearer must return the strict sanitized
401/no-store contract. This is a required control, not app authentication.
Both A/B passwords, verified UUID sessions, refresh and independent own/cross
provider controls remain mandatory. Native result/phase/post evidence records
only the validated mode enum. It contains no reusable credential or provider body.

## Provisioning gate and secure transfer

Provision nothing before the recovery PR's substantive independent security
review, zero unresolved material blockers, required CI and merge. Before generation,
establish a supported secret-safe transfer into the exact protected GitHub
environment and a supported removal path. If unavailable, leave dispatch OFF,
generate nothing and report the missing secure capability. Never use chat, tool
output, CLI arguments, repository files or plaintext transfer files as a handoff.

Vercel may automatically designate a bypass as the deployment system variable
`VERCEL_AUTOMATION_BYPASS_SECRET`. This is NOT authorized application storage.
The documented API can update an existing credential with `isEnvVar:false`.
Verify that designation is absent before any deployment can receive the key;
do not rely on an unknown/ignored generate parameter. If application isolation
cannot be guaranteed by the supported provisioning path, do not provision.
Do not change ordinary app environment variables or redeploy to achieve this.
Confirm secret NAME existence in GitHub without retrieving its value.

Authorize H externally only after the exact reviewed recovery merge, retain
main-only environment restrictions and activate the existing one-attempt workflow
only after all provisioning, attribution and provider preconditions pass.
Perform the existing real metadata/browser acceptance, then separately complete
the genuine outstanding C1 fixture matrix. Scoped native completion always remains
BLOCK until those required rows pass; the fallback adds no fixture writes or
privileged provider access to this runner. Historical unchanged application
evidence may be reused under AGENTS.md, never relabeled as hosted proof.

## Mandatory external revocation

The live external management executor retains responsibility for revocation on
PASS, BLOCK, timeout or cancellation; runner session/context cleanup is separate.
`revokeAutomationBypass` invokes three bounded adapters sequentially, attempts all
even if one fails, and emits only `C1_GUARD_BLOCK` on failure:

1. Using the existing Gmail Vercel connector and fixed project/team, call
   `update_project_protection_bypass` with `revoke:{secret,regenerate:false}`.
   The value must remain private to the authorized management execution, never
   evidence or a tool-output dump. No replacement key and no second installation.
2. Remove only `C1_AUTOMATION_BYPASS_SECRET` from `c1-native-preview`.
3. Request only the approved immutable Preview with the old value using the
   same redirect/host guards; require deployment protection again. Verify the
   environment secret name is absent and no application-env designation remains.

The helper is the external cleanup contract, not an admin-enabled CI job and not
proof of actual revocation. The executor must record actual provider/storage
results. Missing revocation cannot be marked complete. Disable dispatch and clear
H after capture, without deleting A/B secrets as an unrelated side effect.
Retaining the bypass requires a separate explicit owner security decision;
default is REVOKE. Runner loss does not imply successful local session cleanup.

## Verification and review

Red-first offline tests cover wrong hosts/aliases/HTTPS, redirects, provider header
isolation, log/evidence/artifact privacy, explicit mode, mandatory Supabase A/B,
unauthenticated application denial, no-credential protection proof, phase provenance
and external revocation/removal verification. No dependency/application source
changes. Run the complete harness suite, JS syntax checks, workflow YAML validation
and root diff check; reuse valid unchanged app CI/build evidence. One independent
review examines these boundaries and the supported provisioning mechanism before
MERGE; one consolidated correction pass followed by targeted verification.

Primary references inspected 2026-10-10:
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- https://vercel.com/docs/rest-api/projects/update-protection-bypass-for-automation
