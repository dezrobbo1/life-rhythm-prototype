# C1 setup and acceptance runbook

Status: local implementation only; hosted acceptance is **NOT RUN — MANUAL ACTION REQUIRED**. This document is a checklist, not authorization to provision, configure trust or apply hosted SQL. See the [reviewed contract](gate8a7c1-account-boundary-contract.md), [human gates](../../docs/HUMAN_GATES.md) and [tracker #179](https://github.com/dezrobbo1/life-rhythm-prototype/issues/179).

## Verified missing capabilities and next owner/operator action

The 2026-10-05 read-only Supabase project listing returned no dedicated Life Rhythm project. The unrelated connected project was not queried or mutated. Existing Vercel project metadata reports Vite, Node 24.x and SSO protection for all except custom domains; its latest reported deployment was READY. That metadata does not identify this implementation's source or establish app root, API routing, native Clerk trust, environment values or A/B authorization. No secret/environment values were inspected. No hosted setup was performed.

1. Owner explicitly identifies or authorizes a **dedicated Life Rhythm** Supabase project, organization, region and plan, with bounded spend approval if needed. Do not reuse the unrelated project or assume a free allowance. This is the next authorization gate.
2. Authorized operator configures the retained Clerk instance's **native** Supabase compatibility and the dedicated project's trusted fixed issuer. Session tokens must carry the operator-controlled `role: authenticated`, real `user_…` subject and `sess_…` session ID. No deprecated shared-secret JWT template, user-editable authorization metadata or second login population. Configure invitation/restricted disposable A/B accounts; there is no app enrollment/admin endpoint.
3. Operator applies independently reviewed metadata SQL only to the explicitly authorized non-production target. In the **same SQL connection** first set `life_rhythm.clerk_issuer` to the approved public issuer; then apply the generated account-boundary migration. It refuses missing issuer configuration and embeds that issuer as a policy literal; a runtime GUC cannot change the trusted issuer. Expose only the dedicated `life_rhythm` schema for these metadata reads. Do not grant runtime writes or function execution. Operator fixture/access creation is separate from runtime and must use only disposable synthetic metadata during C1 acceptance. The committed fixture loader is local-test-only.
4. Operator confirms existing Vercel project root is `app`, Node 22 or 24, and filesystem `/api/account/boundary.ts` dispatch precedes the SPA rewrite. Do not alter deployment protection, security settings or create a bypass token. A permitted code preview from existing CI is not boundary acceptance. Static Pages cannot supply the API and required mode must stay closed there.
5. Through the approved provider environment channel, operator supplies **public** configuration below; do not send passwords, private keys or bearer tokens in chat. The task has not changed those settings. Use exact approved origins, including a deliberately authorized preview origin if applicable; no wildcard, arbitrary Host-derived trust or broad preview suffix.
6. On the attributable reviewed preview, operator demonstrates real native Clerk A/B sessions: own access/head only, absent/disabled access denial, foreign/expired/forged session denial, direct Data API own-row isolation and denied writes, version/head/error cases, no-store and API JSON routing. Record exact SHA, origin, native integration identifier and issuer/key ID, token lifetime, browser evidence and results. No personal profile is uploaded. Only after actual evidence and independent review can C1 PASS be considered.

## Public configuration contract

| Boundary | Required names and meaning |
| --- | --- |
| Vite | `VITE_LIFE_RHYTHM_MODE=required` (also the default), `VITE_LIFE_RHYTHM_AUTH_ENABLED=true`, `VITE_CLERK_PUBLISHABLE_KEY` for the retained instance. Missing flag/key or invalid/production fixture mode renders a closed error surface. A build can produce that closed surface; build success alone is not configured account access. |
| Node verifier | `CLERK_ISSUER` exact HTTPS origin; `CLERK_JWT_PUBLIC_KEY` RSA SPKI public key (at least 2048 bits); `CLERK_JWT_KEY_ID` exact issued signing-key ID; `LIFE_RHYTHM_ALLOWED_ORIGINS` comma-separated exact origins (maximum eight). Issuer, signing key/ID, session identity/type, algorithm, time and required authorized party are checked. |
| Optional audience | `CLERK_ISSUED_AUDIENCE` **only** if the retained issuer actually issues it. Otherwise omit it; do not invent one. |
| Metadata provider | `SUPABASE_URL` for the dedicated HTTPS `*.supabase.co` project; `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…` only). Legacy/privileged keys are rejected. Runtime sends the verified caller's bearer on a fresh client for each request. No database password, service-role key or Clerk secret is used. |
| Build attribution | `LIFE_RHYTHM_BUILD_ID`, or existing `VERCEL_GIT_COMMIT_SHA`, is required for the Node boundary. Responses expose protocol/schema 1 separately from Dexie 6 and portable-v1. |

The selected SDK path is networkless public-key verification. It does not discover keys from the caller's issuer, contact Clerk's backend or use a JWKS cache. An unrecognized `kid` or changed signing key denies access until the operator updates the authorized public key/ID pair. Public-key rotation is configuration work, not a reason to introduce a backend secret. Local crypto tests obtain a public key from a local JWKS served from ephemeral in-memory signing material; that test trust is never a deployment setting.

Synthetic tests issue 60-second sessions. The retained hosted issuer's actual lifetime and rotation policy were **not inspected or established**; the operator must record its short session-token lifetime before hosted acceptance. Local JWT verification is not instantaneous session revocation. Sign-out clears app requests/state; a copied unexpired token may remain usable until expiry. Disabling access independently denies subsequent head reads, including direct Data API reads. C1 makes no personal-state durability claim.

## Reproduce safe local checks

From `app`:

```text
npm ci
npm run typecheck:server
npm run test:server
npm run test:database
npm run test:data-api
TZ=UTC npm test
TZ=Australia/Perth npm test
npm run build
npm run check:client-privacy
npm run test:browser:c1
npm run source:manifest
```

Database checks require Docker. `test:database` uses a disposable PostgreSQL 17 container with no network/port and tmpfs state. The separate Data API test uses a disposable dedicated bridge, an unpublished PostgreSQL container and PostgREST 13.0.7 exposed only on an ephemeral loopback port. Both remove containers/network/state; signing keys remain in memory. Local trust authentication is confined to disposable test containers. No persistent credentials or hosted target are involved. SQL JWT-GUC injection proves normal-role policy/grant semantics; local signed-JWT PostgREST proves local transport and RLS behavior. Neither establishes **native hosted Clerk/Supabase integration** or Supabase gateway configuration.

For explicit local app exploration, set `VITE_LIFE_RHYTHM_MODE=local-fixture` when running Vite development/test. Production interprets that as invalid and never mounts ordinary content. For a local required-mode API bridge use `npm run dev:api` and `LIFE_RHYTHM_LOCAL_API=true npm run dev` with intentionally authorized public verification/provider settings; absence is still 503. No fixture trust is built into that API. Browser replay has a separate test-server Clerk alias and intercepted synthetic responses; it never changes the production entry or config.

Before C2 real-data consent, region, retention/backups/deletion, privileged operator access, destination disclosure and migration consent are separate gates. C2/C3, live calendar and integrated 8A8 remain unfinished. 8B has not started.
