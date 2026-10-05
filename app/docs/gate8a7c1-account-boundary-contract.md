# Gate 8A7C1 — Verified account and server boundary

Status: owner-approved provider amendment, implemented locally on draft PR #180; unmerged and **NOT ACCEPTED HOSTED**. Date: 2026-10-05 UTC. Verified main/base: `b58b7442c478770f9c0e1db9b6208c8c8e803e30`.

## Authority and provider decision

[MVP_PLAN](../../MVP_PLAN.md) owns readiness/sequence; [ARCHITECTURE](../../ARCHITECTURE.md) owns technical boundaries; [AGENTS](../../AGENTS.md), [workflow](../../docs/CODEX_WORKFLOW.md), [human gates](../../docs/HUMAN_GATES.md) and [documentation authority](../../docs/DOCUMENTATION_AUTHORITY.md) apply. Owner approved changing C1 and existing PR #180 to **Supabase Auth as sole login authority** (“ok continue with Supabase Auth”). This replaces the Clerk-specific selection in merged #177. It does not authorize hosted Auth settings, accounts/credentials, schema apply, email services, Vercel changes or personal-data movement.

History: merged #52 proposed Clerk as a likely login-shell option; #53 implemented an optional shell disabled by default, and #54 added local ID-derived namespaces. No real Clerk application, configured issuer or successful native sign-in was established. The earlier C1 choice retained that code; it was not evidence of an operational provider or owner account. Preserve those historical records; prior Clerk review/test evidence is not transferable to changed source.

## C1 scope and architecture

Supabase Auth + dedicated Supabase metadata schema + small same-origin Vercel Node API. Retain React/Vite/Dexie and protected legacy root. No second login authority, public signup, admin interface, calendar or AI. C1 verifies restricted account access and compatibility only. Local app data remain device-only. C2 owns personal persistence/hydration/previewed consented migration; C3 owns durable outbox/idempotency/offline/conflict/reset/recovery. No C1 PASS, integrated 8A8 PASS or 8B start follows local tests.

Dedicated project identified read-only: `life-rhythm`, ref `lfwadowwdvcnibjkeerg`, organization `xbwsomlomdmyipdbaipk`, Sydney `ap-southeast-2`, ACTIVE_HEALTHY. Owner selected Free; API metadata did not independently establish billing tier. Catalog read confirmed no `life_rhythm` schema or migrations. Never use the unrelated connected project.

## Restricted sign-in and session lifecycle

1. Operator-created email/password accounts only; no app signup, anonymous sign-in, OAuth flow or admin API. Hosted signup must be disabled by an authorized operator; absence of a signup button alone is not provider access control. `trial_access.enabled` independently gates every metadata read. Login credentials go directly to the dedicated Supabase Auth endpoint over TLS, not the Life Rhythm API/logs/profile/export.
2. SDK sessions (including refresh token) remain in tab memory: `persistSession:false`, `autoRefreshToken:true`, `detectSessionInUrl:false`. No localStorage/cookie credential persistence or URL token ingestion. Reload/tab close requires sign-in again; this is a conscious C1 limitation, not durable/offline session recovery. Browser password-manager behavior is user/browser controlled. Password state clears on submission; errors are generic.
3. Auth initialization remains closed. Null, malformed, expired or changed sessions cannot retain an old authorized app. Bind UI requests to issuer/user/session, abort previous requests and discard late responses. Fresh bearer remains in memory and is forwarded per request. Refresh updates the bearer; access-token expiry without refresh closes content. Sign-out clears UI immediately, stops refresh, requests SDK local-session sign-out, and stays closed even on provider failure. Other devices are not signed out by this UI action.
4. Client JWT decoding identifies a request/session only; it is never server authorization. Server independently verifies signatures/claims. Copied unexpired access tokens are not instantaneously revoked; operator access disablement independently denies subsequent head reads. Record actual token lifetime/signing-key rotation and recovery policy at hosted acceptance.
5. No app password-reset/email-delivery promise. UI states recovery is not configured and directs the owner to the operator. Dashboard credential recovery, confirmation/invitation delivery and any SMTP service remain separately authorized manual work; do not create another identity to “recover” account data. Default email service is limited to authorized organization-team recipients, best effort, and not a production recovery assumption.

## Verified sessions, origin and privacy

Only `Authorization: Bearer` Supabase Auth user-session access tokens. No arbitrary IDs, API keys, machine/anonymous/OAuth-server tokens or cookies authorize the API. Use JOSE `jwtVerify` with fixed dedicated-project issuer `SUPABASE_URL + /auth/v1`, audience `authenticated`, approved public JWKS and ES256/RS256 algorithms. Never fetch trust from a caller-controlled issuer or use a shared signing secret/backend admin key.

Require exact issuer, signature, configured key ID, JWT header type, numeric expiry/issued-at, valid UUID text subject and `session_id`, `role:authenticated`, `is_anonymous:false`, supported assurance level. Optional `nbf` must be numeric and satisfied when present; future issued-at fails. Audience must be a nonempty string or entirely nonempty string array with an exact authenticated match. Reject OAuth `client_id`, API-key `ref`, token-type overrides, malformed/bounded tokens and unknown keys before provider reads. Supabase sessions do not issue Clerk `sid`/`azp`; do not require or fabricate those claims.

Public JWKS configuration accepts 1–4 distinct public RSA >=2048-bit or P-256 verification keys only. Reject private fields, symmetric/unsupported keys, malformed config. This pinned networkless trust must be updated through authorized deployment configuration when keys rotate; unknown keys deny access. Public verification config is not a secret. No privileged runtime Supabase key or persistent fixture signing material.

Preserve separate exact origin rules: approved Origin when supplied; otherwise same-origin Fetch Metadata plus request URL in allowlist. Deny foreign/cross-site/missing signals, wildcard CORS, suffix/Host-derived trust. Origins are not identity credentials. All responses private/no-store. Fresh caller-bound provider client uses publishable key plus verified caller bearer; never service-role. Sanitized logs/errors contain request ID/category/build/timing, not tokens, credentials, account email or content. Bound request and response parsing; no real profile serialization/upload.

## C1 metadata schema and API

C1 migration defines only `trial_access` and `account_heads`. Both have indexed composite primary key `(issuer text, subject text)`; heads reference access. Access holds `enabled boolean`; heads hold `protocol_version`, `canonical_schema_version`, `revision bigint >= 0`, `generation uuid` and `updated_at timestamptz`. Each head is one account, no content payload. The canonical/schema number is separate from Dexie database version 6 and portable format v1. Initial supported protocol/schema are exactly 1.

Enable and force RLS on both tables. Explicitly revoke default/anonymous/public writes and function execution; grant authenticated SELECT only for these metadata tables. An access row is selectable only for its own verified issuer/subject. A head is selectable only for that same identity **and** an active access row. Check claims with `auth.jwt()` issuer/subject, rather than requiring a UUID table conversion. Pin the dedicated Supabase Auth issuer in provider integration and policies. No security-definer bypass or RLS-bypassing runtime key. Explicit grants and RLS are separate controls and must both be tested. A migration/fixture operator is privileged separately from runtime; credentials are never committed or used by an app request.

`GET /api/account/boundary` takes only required `protocolVersion=1` and `schemaVersion=1`, with optional paired `expectedRevision` and `expectedGeneration`. Reject unknown/repeated parameters, owner/account fields, malformed decimal revisions, missing pairs, unsafe lengths and bodies. Bound query/header parsing. No POST/PUT/PATCH/DELETE capability is enabled by C1 (405).

| Result | Contract |
| --- | --- |
| 200 | Verified active account; return protocol/schema, build ID and `head: null` (no enrollment yet) or `{revision, generation}` from its own compatible head. Do not manufacture a profile or write during GET. Local work remains explicitly device-only at C1. |
| 400 | Invalid request shape/owner override/unsupported syntax; no database mutation. |
| 401 | Missing, expired, forged, wrong-issuer/type/authorized-party session; no database read. |
| 403 | Origin/access denial; no profile or other-account metadata disclosed. |
| 409 | Expected revision/generation differs, or a supplied expectation has no head. Return only the authenticated account's current compatible head; preserve caller work. No repair/overwrite/retry as a new write. |
| 426 | Client protocol/schema differs, or stored head is incompatible. Stable upgrade-required category; do not reinterpret unknown state or manufacture an empty profile. |
| 503 | Missing/wrong backend configuration, provider failure, unreadable/invalid head or unverified boundary. No local-mode fallback or success/durability claim. |

Represent bigint revisions as canonical unsigned decimal strings in JSON/TypeScript (within PostgreSQL bigint range); compare without lossy JavaScript number coercion. Generations are opaque server-issued UUIDs. A successful C1 read does not advance either value. Actual creation, compare-and-swap increment, operation-ID deduplication and reset advancement belong to C2/C3 transactions. C1 provides a pure typed expected-head guard; validation alone is not concurrency protection for a later write. A stale check followed by an unconditional write is prohibited.

## Canonical inventory for later authorized data movement

The current inventory follows `portableProfileBackup.ts` and ARCHITECTURE, not every Dexie table. C1 declares a separate versioned canonical projection schema/shared types; it never serializes a real profile or wires repositories to upload. Reuse strict entity/relationship checks with an explicit adapter; importing Dexie/browser code into functions is not required.

| Required class | Existing authority and treatment |
| --- | --- |
| Settings and day profiles | `schemas.ts`, `settingsRepository.ts`, `dayProfileMigration.ts`: combined validated settings/day-profile foundation and seven-day assignments; preserve absence distinctly from explicit configuration. Unknown/orphan foundation fails safely. |
| Explicit preferences | `explicitPreferenceSchema.ts` / repository; dedicated settings sidecar with provenance. Do not silently fold it into permissive settings fields. |
| Duration-learning controls | `durationLearningControlSchema.ts` / repository; preserve controls and valid historical references even if original templates no longer exist. Derived statistics are rebuildable. |
| Rhythms | `rhythmAuthoritySchemas.ts`, `rhythmAuthorityRepository.ts`, `libraryRhythmRepository.ts`: templates, plans, recurrence revisions and instances; preserve immutable occurrence/provenance/link identities. Catalogue defaults/enable flags alone are not user authority. |
| Active Today and Pool | `schemas.ts`, `activeTaskRepository.ts`, `taskPoolRepository.ts`, lifecycle coordinators: authored variants/minutes/status, linked Pool/Today consistency and no duplicate rhythm intention. |
| Ordinary soft placements | `softPlacementRepository.ts`, `schemas.ts`: private user authority distinct from external events; preserve target/linked occurrence/correction identity and protection. |
| Trusted factual behavior | `behaviourEventRepository.ts`, `schemas.ts`, `taskHistory`: only validated trusted behavior events enter canonical replication. Unknown legacy raw history stays locally/exportably preserved and explicitly outside this projection; never promote it into invented completion/Normal samples. |
| Static calendar snapshot/configuration | `calendarSourceSchema.ts`, repository and portable calendar expansion checks: current single source, imported reality, timezone/status/buffer configuration. Distinct external IDs, no inference of usable capacity. Multiple/unreadable sources fail safely. No live provider token enters this class. |
| Live routed rhythm coordinates | Validated `routedRhythmPlacements` subset from `schedulerPlanStateSchema.ts` / portable checks, only for live routed occurrences lacking separate correction authority. Preserve one occurrence owner and necessary accepted coordinates to resume. Never replicate the full stale scheduler plan as canonical authority. |

`completionLog`, `resetLog`, `startBoostLog`, `devTickets`, `migrationLog`, raw legacy storage/history and full `schedulerPlanState` are not automatically account payloads. Preserve existing local data; exclusion from canonical replication is not deletion permission. Full plan, derived learning summaries, UI state and caches rebuild from validated canonical inputs with repair attention. Local `profileRecoveryGeneration.ts` is a local race fence, not the server account generation; keep both and do not copy an old local token as server authority. C2 must explicitly validate the complete inventory and preview any excluded legacy evidence before consent; no silent truncation/down-conversion. Transport bounds must respect deployment/provider limits; portable's 16 MiB limit is not an accepted API payload size.

## Ownership, local preservation and later migration

Server account key remains `(verified issuer text, verified subject text)`; Supabase UUID subjects fit text columns. RLS pins the dedicated Auth issuer literal and own JWT subject, with enabled access required for heads. SELECT grants and forced RLS are independent controls. No UUID schema rewrite, user-metadata/email authorization or runtime write.

New Supabase local namespace input is `issuer|subject`; existing namespace hashing algorithm, Dexie 6, legacy database, prior Clerk-derived names and portable-v1 bytes stay untouched. Do not inspect/merge/delete another namespace or infer ownership by email. No automatic identity mapping. If a genuine old account is discovered, linking/migration needs explicit ownership verification and C2 preview/consent. Browser-clear continuity remains unfinished until C2/C3.

## Implementation paths and verification

Affected auth adapter/config/UI and tests; shared pure metadata schemas unchanged; server verifier/config/tests; metadata migration issuer binding and synthetic UUID fixtures; signed Data API/browser replay; package/lock and privacy scan; current architecture/contract/runbook/evidence. Scheduler, portable/recovery formats and legacy root are unchanged.

Use red-first signed-session tests with ephemeral RSA/EC keys and local JWKS; expired/forged/foreign/malformed/audience/role/anonymous/session cases reject before any provider read. Test actual SDK memory-only session storage and sign-out, UI initialization/error/session switch/late response/expiry and explicit fixture mode. Real isolated PostgreSQL 17 proves A/B normal-role own reads, disabled/missing/foreign denial, independent grants/forced RLS and writes denied; isolated signed PostgREST tests prove transport and policy together. No in-memory substitute for database proof. Neither fixture trust nor local signed-token transport proves native hosted Auth.

Run full app tests/build, Node 22/24 server typechecks/focused tests, SQL and Data API matrix, UTC/Perth controls, responsive/keyboard browser replay, API-before-SPA routing, built-client/export/privacy scans and diff check. Preserve exact source manifest and concise row-level evidence; do not commit build outputs/screenshots/private keys. Fresh independent review is required for amended source; BoB performs review coordination and any permitted merge. No automatic CI retry loop when runner assignment fails.

## Hosted manual gate and next acceptance

[Setup runbook](gate8a7c1-setup-runbook.md) identifies exact target/configuration and bounded acceptance. Owner/provider approval still required for non-production Auth signup restriction/account creation/recovery, public signing-key settings, reviewed metadata-only schema/exposure/access rows and preview-scoped Vercel configuration. No further project provisioning is requested. Root `app`/API routing and native A/B sessions must be verified, with exact build/origin/provider settings identifiers and token lifetime. No protection/security/bypass-token/production changes.

Before C2 personal data, separately resolve region/retention/deletion/backups/operator access, destination disclosure and migration consent. Existing Vercel preview metadata reports `iad1`; Sydney database does not establish Australia-only processing. Required deployment errors remain closed; local test fixtures never bypass hosted authorization. C1 acceptance remains NOT RUN until native attributable hosted evidence and independent review exist.

## Official references checked 2026-10-05

[Supabase password Auth](https://supabase.com/docs/guides/auth/passwords), [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields), [JWT/public-key verification](https://supabase.com/docs/guides/auth/jwts), [sessions](https://supabase.com/docs/guides/auth/sessions), [sign-out](https://supabase.com/docs/reference/javascript/auth-signout), [SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Changelog markdown fetch was unavailable; HTML changelog and relevant guides were checked. Provider setup is not implied by these references or installed tools.
