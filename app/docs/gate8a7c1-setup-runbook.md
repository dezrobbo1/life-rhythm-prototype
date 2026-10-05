# C1 Supabase Auth setup and acceptance runbook

Status: owner-approved local provider amendment on draft #180; **NOT ACCEPTED HOSTED — MANUAL ACTION REQUIRED**. This checklist does not authorize hosted changes. [Contract](gate8a7c1-account-boundary-contract.md), [human gates](../../docs/HUMAN_GATES.md), [tracker #179](https://github.com/dezrobbo1/life-rhythm-prototype/issues/179).

## Exact target and verified limits

Dedicated Supabase project `life-rhythm`, ref `lfwadowwdvcnibjkeerg`, organization `xbwsomlomdmyipdbaipk`, Sydney `ap-southeast-2`, ACTIVE_HEALTHY. Owner approved a separate Free project and entered its password themselves; project API did not independently verify billing tier. Read-only catalog confirmed no `life_rhythm` schema/migrations. Do not provision another project or query/reuse the unrelated project.

Supabase Auth replaces the optional Clerk code. No real Clerk instance/account/sign-in was established; do not invent an account mapping or configure Clerk trust. Dedicated-project Auth signup policy, user accounts, signing algorithm/JWKS, email/recovery settings and native sign-in are **unverified**. No keys, secret/environment values or user records were retrieved.

Existing Vercel project `life-rhythm-prototype`, ID `prj_Os5Ucic7cDQwut3mO3I39V3lc52s`, team **Dale's projects** / `daler-project-lr`, ID `team_EeRBGaTcRamnOpGbT1RswHVc`, Vite, Node 24.x. Existing deployment metadata reports SSO protection, region `iad1`; Sydney database does not imply Australia-only processing. Project root is not exposed by the available metadata. Anonymous navigation was blocked by environment proxy CONNECT 403 before origin; no deployed UI/routing claim or protection bypass.

## Smallest next approval bundle

Owner explicitly authorizes bounded **non-production C1 acceptance** on the exact independently reviewed amended PR #180 head and dedicated project above:

- Restrict Supabase Auth signup/anonymous/OAuth entry; create disposable A/B test accounts via authorized dashboard operation, using synthetic metadata. Passwords remain user/operator-only, never chat/repo/logs. This is account/credential configuration authority, not implied by project creation or design approval.
- Apply only the reviewed two-table metadata migration; expose `life_rhythm` for Data API reads while preserving other provider settings; seed bounded synthetic access/head rows, including enable/disable denial tests. No runtime writes/admin endpoint/personal profile.
- Configure only the existing Vercel project's **Preview / `feat/gate8a7c1-account-boundary`** public settings and exact approved origin, then produce an attributable new preview. Keep Production, protection/security/bypass settings unchanged. Confirm existing root `app`; if different, stop for separate layout disposition rather than changing global root under this bundle.
- Run bounded native Auth session/direct-provider/browser acceptance; keep access/refresh tokens in memory only, sanitize evidence. No hosted signing-key change/rotation, SMTP provision/spend, identity migration, production changes or merge.

Design approval alone does not approve this bundle. Operator credential recovery for the eventual owner account and any email/SMTP service remain separately scoped before longitudinal use. No passwords/private keys/secret keys need to be supplied to the application operator through chat.

## Operator sequence after authorization

1. In the dedicated project's Auth dashboard verify email/password support, disable public signup and anonymous entry, and restrict the authorized trial population. Create disposable confirmed A/B users via the approved dashboard path. Record their provider UUIDs in operator-only acceptance setup; server ownership comes from verified token issuer/subject, never email or user metadata. App `trial_access` remains an independent allowlist.
2. Inspect the project's **public** JWKS at `https://lfwadowwdvcnibjkeerg.supabase.co/auth/v1/.well-known/jwks.json`. Existing code supports approved ES256/P-256 or RS256/RSA >=2048-bit public keys. If asymmetric keys are unavailable, STOP: no shared-secret fallback, signing-key rotation or trust change is authorized by this checklist. Propose the smallest separate signing-key action. Record actual token expiry and key rotation/update policy.
3. In the same SQL connection set `life_rhythm.auth_issuer` to `https://lfwadowwdvcnibjkeerg.supabase.co/auth/v1` before executing reviewed `supabase/migrations/20261005184536_account_boundary.sql`. It embeds this issuer as a policy literal. Preserve SELECT-only authenticated grants and forced RLS. Add `life_rhythm` to exposed schemas without replacing unrelated defaults blindly. Seed synthetic metadata only for assigned disposable UUIDs; do not apply the committed local fixture loader to hosted identities. Record migration source/hash/operator application evidence.
4. Verify Vercel root `app` and `/api/account/boundary` dispatch before SPA fallback. Inspect only the specific required public settings through the approved provider channel; never export environment lists containing secrets. Add branch-specific Preview values below. A changed variable applies to a **new** deployment; it does not retrofit the old preview. Prefer exact authorized stable branch origin to avoid wildcard preview suffixes.
5. On the reviewed new build demonstrate native A/B password sessions: own access/head only, uninvited/disabled denial, direct Data API isolation and denied writes, forged/expired/foreign/malformed token rejection, protocol/head/bigint/error/no-store behavior, API JSON routing, account-switch/late response/sign-out/reload/expiry and responsive/keyboard surfaces. Record exact SHA/fingerprint/origin, settings identifiers, provider key IDs/algorithm, token lifetime and sanitized PASS/FAIL/NOT RUN evidence. No real profile is uploaded.

## Public settings

| Location | Required values |
| --- | --- |
| Vite | `VITE_LIFE_RHYTHM_MODE=required`, `VITE_LIFE_RHYTHM_AUTH_ENABLED=true`, `VITE_SUPABASE_URL=https://lfwadowwdvcnibjkeerg.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…` |
| Node | `SUPABASE_URL` same dedicated URL; `SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`; `SUPABASE_AUTH_JWKS` JSON of approved public verification keys, 1–4 distinct keys; `LIFE_RHYTHM_ALLOWED_ORIGINS` exact comma-separated origins, max eight |
| Attribution | `LIFE_RHYTHM_BUILD_ID`, or existing `VERCEL_GIT_COMMIT_SHA`, must identify the reviewed source |

No Clerk settings, optional fabricated audience, database password, service-role/secret key or Auth admin credential is used at runtime. Fixed server issuer is the project URL plus `/auth/v1`; required audience is `authenticated`. Public project/publishable configuration may enter the frontend; signing verification settings remain server configuration. Private keys and session/refresh tokens must never enter VITE env, bundles, profiles or exports.

## Session and recovery boundary

Sign-in is operator-created email/password only. SDK `persistSession:false`, `autoRefreshToken:true`, `detectSessionInUrl:false`: session/refresh credentials remain in this tab's memory. Reload/tab close requires sign-in again. Sign-out immediately clears app state and requests local SDK sign-out; it does not sign out other devices or promise instant access-token revocation. Expiry without refresh closes content. Disabled access independently denies later head reads.

No signup/reset/confirmation/invitation-email workflow exists in the app. UI honestly says password recovery is not configured. Default Supabase mail is team-address restricted, best effort and rate limited; it is not assumed reliable recovery for the owner trial. Choose and authorize the smallest same-account recovery/email path separately; do not create another account or silently link by email. SMTP/payment/provider credentials require their own authorization. Before C2 real data resolve region, retention/backups/deletion, operator access, destination disclosure and consent.

## Safe local reproduction

From `app`:

```text
npm ci
npm run typecheck:server
npm run test:server
npm run test:database
npm run test:data-api
TZ=UTC npm test -- --maxWorkers=1
TZ=Australia/Perth npm test -- --maxWorkers=1
npm run build
npm run check:client-privacy
npm run test:browser:c1
npm run source:manifest
```

Docker tests use isolated disposable PostgreSQL 17 and PostgREST 13.0.7 with synthetic UUID identities and ephemeral signing material; state/containers/network are removed. SQL claim injection proves normal-role grants/RLS, and signed local JWT traffic proves local verification/transport/policy. Neither proves the hosted Auth gateway/settings.

Explicit Vite development/test `local-fixture` can explore preserved legacy local data. Production fixture mode is invalid and cannot bypass required hosted authorization. Browser replay aliases only the SDK on a separate test server and intercepts synthetic metadata responses; production uses real Supabase SDK. Browser replay is not native hosted provider evidence. Static Pages cannot host this API and required mode stays closed.

CI run `37363612961` attempt 2 at prior head `2330b45…`: completed failure, test/build job cancelled, runner ID 0/name empty, zero steps. No further blind retry; GitHub Actions runner/service/account eligibility needs an operator investigation, separately from provider authorization.
