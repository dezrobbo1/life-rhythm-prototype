# C1 native acceptance infrastructure — draft, BLOCK

Current recovery, 2026-10-10: [automation-bypass-contract.md](automation-bypass-contract.md)
records the owner-authorized temporary project-wide Automation Bypass fallback,
explicit transport mode and mandatory revocation. It supersedes historical
prohibitions on a reusable transport bypass ONLY within that bounded recovery.
No credential is provisioned by source changes; no full C1 PASS is claimed.

Current continuation, 2026-10-09: PR #181 is merged. The owner authorized a bounded
automated-observer redesign, described in
[automated-observer-contract.md](automated-observer-contract.md). The proposed
default-off mode trusts owner-authorized external Work connector automation,
with isolated pre/native/post job verification, rather than requiring a second
GitHub person. It introduces no CI Vercel credential and does not claim
second-person independence or provider-signed metadata. One independent security
review is required before activation. PR #180 stays draft; hosted C1 NOT_RUN.

The material below records the earlier independent-human design and dated
authorization limits. Those historical limits do not supersede the owner's
2026-10-09 continuation authorization. Immutable deployment admission, request
containment, OIDC, account isolation, cleanup, deadlines and fail-closed coverage
remain binding in both modes.

Code-only authority: owner approval on 2026-10-07 permits implementation and publication of one draft infrastructure PR. No merge, dispatch, password entry, environment/trust configuration, deployment or Supabase change. PR #180 remains draft/unmerged, C1 BLOCK. Existing local/API/browser-mock and App CI results are not hosted acceptance.

## Scope and implementation contract

Independent reviewed harness on default `main`; never checkout application PR code in this workflow. `policy.mjs` owns identity, origin, request, budget, strict response and output guards. `preflight.mjs` performs read-only GitHub repo/default-main/PR/exact-head independent-review/check/status validation. `native.mjs` supplies normal Auth login/refresh/local logout, cryptographic UUID controls, read-only provider/API cases and real browser rows. `admission.mjs` implements public-config parsing, GitHub OIDC issuance/verification and supervised GitHub observation admission. `orchestrator.mjs` wires the complete bounded native sequence and sanitized evidence. `run.mjs --admission` verifies deployment attribution before the separate secret step; normal `run.mjs` executes the suite. Only strictly selected JSON is uploaded. Tests use generated keys and synthetic responses; no hosted requests occur in the offline suite.

Locked Node 24.19.0; Acorn 8.15.0, jose 6.1.0 and Playwright/core 1.63.0 with separate integrity lockfile. Playwright's locked release selects Chromium 153.0.8010.12, revision 1243 (`node_modules/playwright-core/browsers.json`); no system/channel browser. Ubuntu 24.04, one serial job/context at a time, project concurrency with cancellation off; no retry. Dependencies/browser installation and offline tests precede any future secret-bearing step. Only the native execution step references the two future environment passwords; dependency preparation, tests and admission receive none. Missing/disabled attribution configuration fails before that step. No password values are configured by this PR.

## Exact target manifest

`policy.mjs` records repository ID `1268056225`, owner ID `228294552`, PR #180 source `5e08c55918eaf64be02d210b17fbcd11c7ec34bf`, deployment `dpl_Ees6UuR6vfNtmuNgk9Qe1zCLqmYi`, project `prj_Os5Ucic7cDQwut3mO3I39V3lc52s`, team `team_EeRBGaTcRamnOpGbT1RswHVc`, and the exact reviewed Preview alias. Provider is only `https://lfwadowwdvcnibjkeerg.supabase.co`, issuer `/auth/v1`. Replacement A/B UUIDs and revisions are dedicated synthetic fixture identifiers supplied for this task; no passwords or personal-state metadata are committed. A revision `9007199254740993` stays decimal text throughout; B is `42`. Enabled access/head protocol/schema must be 1/1.

Historical native UI passes under the original account identities remain historical and unchanged. Future rows belong to the replacement pair only. Source/deployment/head drift, missing/foreign/cross-account identity, unexpected rows, writes, leakage, rate limiting, CAPTCHA, timeout or unsuccessful cleanup must BLOCK.

## Supervised observation contract — disabled, no signing service

The unprovisioned Ed25519 endpoint is replaced by existing GitHub approval/evidence
facilities. No service, signing key or management token is created. Config is default
off: no approved immutable origin, trusted observer IDs or pinned environment IDs.
The old branch alias/source/deployment stay historical, blocked targets. Local PR #180
self-origin code does not authorize publication, deployment or settings.

A trusted operator independently observes the exact deployment through the existing
Vercel connection: ID, canonical immutable URL, project/team, Git repository/SHA,
Preview and READY. No raw environment, bypass/protection or secret fields may be read
into evidence. `get_deployment` supports Git information but has no projection input;
a safe metadata-only projection/view must be established before future observation.
No provider call is made here. Missing facts are BLOCK.

The operator posts only a strict compact canonical JSON receipt as a comment on PR #181 using the existing
GitHub connection, then approves its protected environment with the exact comment
`C1_RECEIPT <GitHub comment ID> <sha256 of exact body bytes>`. The harness itself reads
GitHub's authenticated API: exact run/attempt/workflow SHA/repository, approved pinned
environment ID/name, pinned numeric User ID different from actor/triggering actor,
same comment/approval author, exact repo/PR URL, digest, unedited server timestamps.
An upload, workflow input, bot/display name or app self-report is not provenance.
This is an authorized operator attestation accountable for a genuine provider lookup,
not a cryptographically provider-signed deployment statement.

Pre receipt has exactly `format:2`, `phase:pre`, repository/repositoryId/ownerId,
runId/attempt=1, harness/source/deployment/project/team/origin, environment=preview,
state=READY, observedAt (canonical ISO UTC), observationMethod=
VERCEL_EXISTING_CONNECTION_METADATA. Observation precedes GitHub comment creation
by at most 30 seconds. The receipt is valid at most 20 minutes, bound to one run and
immutable deployment, and is reread before each credential submission and at phase
end. Dependency preparation consumes that interval. Expiry, repeated/ambiguous or
rejected approval histories, edits, unknown fields and target/run drift are BLOCK.

Native success is always `TEST_PHASE_COMPLETE_PENDING_POST`, C1 BLOCK. It emits only
sanitized `results.json` and fixed-schema `phase.json`. Reviewed workflow `needs`
outputs carry phase bytes/base64, SHA256 and exact GitHub native-job ID; no workflow
input or uploaded observation supplies them. Existing GitHub artifact-read tools can
retrieve those fixed files without another credential. Artifacts are evidence of the
native test phase, never evidence of Vercel observation.

A second protected environment `c1-native-post-verification` gates a separate
three-minute read-only job after native job completion. It has no account passwords
or OIDC permission. The independent operator observes Vercel again, checks the real
successful native-job ID/run/attempt/head/name and GitHub completion time, downloads
phase.json through the existing GitHub artifact tool and verifies its digest. A new
post receipt/approval repeats the target/run bindings and adds phaseDigest, preReceipt
and completedAt = **GitHub native-job completion timestamp**. Its observation/comment
must follow that timestamp and be no older than five minutes. The post job checks
job success/provenance, exact digest and independent GitHub receipt; source/review/check
preflight runs again. Only a matching post record produces SCOPED_ROWS_COMPLETE.
C1 remains BLOCK for excluded genuine fixtures and owner gates. Missing post approval
or failed verification leaves native evidence pending, never acceptance PASS.

Unresolved action-time gates: independently approved observer identity different
from initiator, actual environment IDs/protection, safe existing Vercel observation,
new approved app source/deployment and its immutable URL, reviewed retargeted harness
SHA, OIDC trust and passwords/run authorization. None is guessed or configured.

## Proposed approval bundle — NOT configured or approved here

1. Review this exact harness/workflow and lockfile independently; parent handles that review. Do not merge this draft as part of this task. After a later authorized merge, identify the first reviewed **full main commit SHA H** containing the harness. An authorized operator records H in `C1_TRUSTED_HARNESS_SHA`; the workflow checks `github.workflow_sha == H`, and both jobs checkout H with `persist-credentials:false`. This avoids a circular self-referential SHA pin: H is authorized externally after review/merge, not embedded in its own commit. Any subsequent main movement fails admission until the new complete main SHA is independently reviewed/authorized.
2. Separately approve and create protected GitHub environment `c1-native-preview`, restrict deployment branches to main, require independent reviewers, prevent self-review and disallow administrative bypass where available. No environment is created by this PR. Repository enable variable `C1_NATIVE_ENABLED` stays absent/false until every gate is satisfied. No secrets in repository-level scopes.
3. Separately approve Vercel External Services Trusted Sources on only the listed project/team, **Preview only**. Issuer `https://token.actions.githubusercontent.com`; exact raw required claims: `aud=https://github.com/dezrobbo1`, `repository=dezrobbo1/life-rhythm-prototype`, `repository_id=1268056225`, `repository_owner_id=228294552`, `ref=refs/heads/main`, `environment=c1-native-preview`, `event_name=workflow_dispatch`, `workflow_ref=dezrobbo1/life-rhythm-prototype/.github/workflows/c1-native-acceptance.yml@refs/heads/main`, `workflow_sha=H`, `runner_environment=github-hosted`. Every value must match, not a broad account/repo template; no assumption about legacy `sub`. Verify the actual raw-claim configuration and GitHub claim availability before any run. Unsupported exact scoping is a blocker.
4. Approve the exact independently observed immutable deployment URL, its app-origin admission and a separately reviewed manifest/configuration change. The current alias must remain blocked. Approve safe existing Vercel metadata observation, pinned independent observer numeric IDs and pinned pre/post environment IDs. Create protected `c1-native-post-verification` with independent review and no account secrets. No Vercel API/admin token or persistent bypass secret, `vercel curl`, env pull, deployment-protection relaxation, explicit deployment or production access.
5. Separately authorize owner entry of only `C1_ACCOUNT_A_PASSWORD` / `C1_ACCOUNT_B_PASSWORD` into that protected environment, through GitHub's secure UI. No password values now; do not send them in chat. The implemented secret step follows successful attribution and dependency preparation; actual secret entry and execution still require separate approval. Passwords, access/refresh/OIDC tokens remain process/browser memory only, never outputs, command arguments, temp files or artifacts.
6. Approve a single explicit future `workflow_dispatch` from main H, maximum 20 minutes, 8 password sign-ins and 200 app/provider requests (190 ordinary requests, 10 reserved cleanup), standard Ubuntu, one worker. No automatic retry or unrelated desktop replays; the first native-job step records an absolute 19-minute deadline before checkout/dependency/browser preparation. Ordinary work stops two minutes before that deadline; setup consumes the same budget. Two minutes/ten requests remain for cleanup, with a further one-minute margin below GitHub's 20-minute job timeout. SIGINT/SIGTERM abort ordinary transport and close contexts, settle tracked session-producing work, then attempt bounded local logout. SIGKILL/runner loss can prevent cleanup and must never be treated as cleanup PASS. First-run acceptance is read-only metadata plus normal Auth session operations, not C2/C3, integrated 8A8 or owner trial.

Official claims support checked 2026-10-07: [Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources) describes GitHub Actions, raw claims including `workflow_ref`, exact required-claim matching, Preview targeting and the header. [GitHub OIDC reference](https://docs.github.com/en/actions/reference/security/oidc) defines workflow, repository ID, event, environment and runner claims. Arbitrary exact raw claims follow Vercel's general matching rule; actual project settings have not been inspected/configured here. [Supabase JWT guidance](https://supabase.com/docs/guides/auth/jwts) documents public-key verification; [local sign-out](https://supabase.com/docs/guides/auth/signout) terminates only the current session. No guarantee of immediate access-token revocation is claimed. Markdown changelog fetch was unavailable; no hosted settings were inferred from it.

## Coverage and honest evidence

Implemented adapters: A/B signed claim/UUID controls; independent own/cross reads on both `trial_access` and direct `account_heads`, plus matching enabled joined head controls; JSON/no-store/strict sanitized errors; protocol/schema, missing/duplicate/unknown query/owner override, exact revision/generation and non-mutating conflict cases; post-case head equality; normal refresh with same session identity; explicit local logout; keyboard login/account opening/signout, overflow and tab-only-storage checks at 390×844 and 1280×844. Browser PASS requires at least one authenticated boundary request with the captured current session token and a validated native response before account opening. A visible shell alone cannot pass. Browser routing forwards OIDC only to the exact Preview origin, rejects foreign origins/redirects, disables service workers/websockets/downloads and blocks metadata mutations. Head comparison cannot rule out invisible external changes; authenticated deployment attribution is still required.

Native adapters, public-config extraction, OIDC issuance, pre/post supervised verification, orchestration and reporting are implemented and offline-tested. Their actual hosted execution, real browser/provider semantics and genuine start/end attribution remain **NOT_RUN / blocked** pending approved configuration/access. Public-config parsing uses nonexecuting ESTree parsing of the effective Vite default-parameter config whose function reads all four required fields, supports actual production backtick strings and rejects comments/unused objects as config proof, dynamic/spread/duplicate fields and conflicting effective configs. An exact production-function fixture from PR #180 is tested with synthetic public values; the complete local production bundle also passed extraction. Static root/module/CSS paths are discovered before credentials; request paths/query/body/header fields are projected through explicit allowlists. The locked SDK's empty `gotrue_meta_security` object is allowed; CAPTCHA or additional Auth body fields fail before forwarding. an unfamiliar layout, ambiguous key/URL or missing flags fails closed rather than executing downloaded application code. Do not represent synthetic transport responses or generated-key verification as native-provider proof. Expired-valid native token, provider 503, stored incompatible head and disabled/uninvited native fixtures are NOT_RUN until genuine fixtures are separately authorized. No negative INSERT/UPDATE/DELETE, no fixture mutations, no existing destructive `test:data-api` on hosted resources.

Only sanitized JSON may upload; allowlisted fields/enum rows plus validated harness/date/browser/viewport/request counters and the supplied synthetic account UUID pair. No raw exceptions/provider bodies/tokens/passwords/URLs enter logs. Partial observations never become PASS; scoped completion still reports C1 BLOCK while excluded genuine fixtures remain NOT_RUN. No storage state, HAR, traces, video, core dump or security log. Authenticated screenshots are omitted; no screenshot acceptance claim. Any later selected screenshot must be independently verified as synthetic UI only and added through a reviewed artifact allowlist. Artifact retention seven days; the sole fixed JSON is below 10 MiB. This is a public repository: artifact/check summaries may be publicly disclosed; that disclosure and synthetic fixture use belong in run authorization.

## Offline verification and revocation

From this directory: `npm ci --ignore-scripts`, `npm test`. No passwords, OIDC or live provider required. Repository guidance additionally requires `npm test` and `npm run build` from `app`, and root `git diff --check`. Date/domain logic is unchanged; no timezone matrix is claimed. No browser or hosted run is dispatched by these commands.

Revoke future capability by disabling `C1_NATIVE_ENABLED`, removing the exact Vercel external-source entry, deleting environment password secrets and clearing H authorization. Running jobs must be stopped by an authorized operator; token expiry does not undo submitted credentials. Cleanup should attempt all opened sessions/contexts within the reserved budget, with `scope=local` only; never global sign-out or disturb existing owner tabs. Logout is confirmed only after HTTP 204. A failed UI logout leaves its known session tracked for bounded local fallback; failure remains BLOCK even when fallback succeeds. Cleanup failure is BLOCK, not PASS. A provider login whose response is lost may have created an unknown session; without its token no safe local revocation can be claimed, so timeout/transport failure remains BLOCK and no retry is attempted. No automatic repair/fixture reset.

Review areas: immutable bootstrap/default-branch admission; independently observed immutable credential origin and unresolved read-only observation access; request/redirect/header containment; cryptographic A/B and lossless revision controls; public-config/OIDC/orchestration/reporting; browser cleanup, aborted-work containment and privacy. Parent arranges independent review and remaining approvals. All hosted acceptance remains NOT_RUN, C1 BLOCK, PR #180 unchanged.


## Local publication boundary

Existing Vercel bot records on both PRs show automatic deployments after publication,
including infrastructure-only PR #181. Both amendments stay local for parent review.
Pushing either existing branch needs separate deployment approval; no integrations
are disabled or changed. Code-only approval does not grant settings/secret/run/merge
authority. Historical original-identity/app-source evidence remains attributed to its
original SHA, and all new-head hosted acceptance is NOT_RUN.

GitHub approval provenance: https://docs.github.com/en/rest/actions/workflow-runs#get-the-review-history-for-a-workflow-run

# Reviewed target continuation — 2026-10-09

The manifest now pins PR #180 source `07469f9f13aa3887a6ec7847b7b642a839651e63`
and immutable Preview `dpl_4GvGzb8vWMvFuPpYjUaJSBv61Vtm` at
`https://life-rhythm-prototype-7it1u92y9-daler-project-lr.vercel.app`.
The Gmail-linked Vercel management connector verified the exact project/team,
source, READY and Preview (`target:null`). GitHub review `5467824686` is an
actual non-author CodeRabbit APPROVED decision at this exact source; App CI
`37906435622` and App Preview `37906435496`, attempt 1, succeeded. Approval was
obtained by normal completed incremental review, not approve/resolve overrides.

The owner-authorized external executor ID `228294552` and exact immutable
origin are configured. `attribution-config.json` is armed, **not authorization
to dispatch**: repository `C1_NATIVE_ENABLED` remains absent/false. The full
reviewed merged main SHA H must still be authorized externally, and exact
Preview-only OIDC required claims configured with action-time confirmation.
No persistent bypass, Production trust, provider-management credentials or broad template.

The main-only environments are `c1-native-preview` ID `23853861553` and
`c1-native-post-verification` ID `23853957047`, with administrator bypass off.
The owner entered only the A/B environment password secrets through the secure
UI; names were verified without reading values. Their validity remains untested.
No workflow has been dispatched and no current hosted matrix or responsive
row passed. C1 remains BLOCK; scoped harness completion still cannot establish
full C1 PASS. Older sections above are dated implementation history; the merged
automated-observer contract governs current attribution mode and trust.
