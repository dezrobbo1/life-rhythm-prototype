# C1 Supabase Auth evidence

Current provider amendment is unmerged on [PR #180](https://github.com/dezrobbo1/life-rhythm-prototype/pull/180). [source-manifest.json](source-manifest.json) fingerprints the amended executable tree; [review-correction-results.json](review-correction-results.json) records current correction results; [supabase-auth-results.json](supabase-auth-results.json) retains the preceding reviewed source. Prior Clerk acceptance/review does not transfer.

Reproduce: `npm run typecheck:server`, `npm run test:server`, focused `vitest run server src/auth src/account src/data/portableProfileBackup.test.ts src/data/localDataNamespace.test.ts src/data/schedulerPlanCoordinator.test.ts src/features/taskPool/taskPoolCapture.test.ts scripts/clientPrivacy.test.ts --maxWorkers=1`, `npm run test:database`, `npm run test:data-api`, UTC/Perth `npm test -- --maxWorkers=1`, build/privacy, and `npm run test:browser:c1`.

Browser replay uses actual production auth/session/UI components with a separate test-server Supabase SDK alias in `supabase-fixture.ts` and intercepted synthetic metadata. `replay.spec.ts` covers 18 rows at 390px/1280px, including real capture-draft preservation/revalidation denial, sign-in fields, errors/keyboard/status/sign-out/switch and memory-only reload/recovery. It is not native hosted sign-in. Actual SDK tests independently prove memory-only storage and delayed successful/failed logout coordination; only HTTP responses are synthetic. No screenshot delivery or physical-device acceptance is claimed.

SQL engine and signed PostgREST transport use disposable synthetic state and in-memory ephemeral signing keys, not the hosted project. No real profile is serialized. [Current implementation report](../../docs/gate8a7c1-implementation-report.md) and [hosted approval/runbook](../../docs/gate8a7c1-setup-runbook.md) retain the actual acceptance gate.

---

## Historical Clerk evidence (superseded executable source)

`results.json` and `audience-correction-results.json` below retain their original source attribution. They are historical records; current amended SQL/client/server/browser boundaries use the new results above.

# C1 local synthetic evidence

Base: `b58b7442c478770f9c0e1db9b6208c8c8e803e30`. Local implementation is unmerged; exact PR head is in the draft PR/handoff. `source-manifest.json` attributes the executable tree (including tests, fixtures, configs, lockfile and app CI). Markdown/evidence JSON are excluded to avoid recursive hashes. Reproduce with `npm run source:manifest`; renew evidence for affected boundaries after executable source changes; document source-independent reuse explicitly.

Browser replay: `npm run test:browser:c1` from `app`. Playwright 1.63.0 uses Chromium 151.0.7922.173 on Linux in this cloud environment. Each row runs at 390×844 and 1280×844 in an isolated browser context. `replay.spec.ts` gives exact actions/assertions. The test server aliases Clerk to `clerk-fixture.tsx` and intercepts metadata responses; those are **synthetic**, never native provider acceptance. Production imports/config are unchanged by the alias and no fixture entry is included in `dist`.

Seven rows per viewport: required missing configuration; signed-out landing/keyboard; healthy device-only content and sign-out; API 401/403/426/503 and keyboard retry; loading plus late A response after B switch. The first row combines missing/signed-out checks; the healthy row covers no-body GET transport and overflow. Total **14 browser tests**; all passed on the original fingerprint recorded in `results.json`. `results.json` retains compact outcomes/runtime/source attribution. No screenshot/build binary is committed or claimed delivered.

SQL: `npm run test:database` runs the forced-RLS/grants matrix from `supabase/tests` against a fresh real PostgreSQL 17.11 engine, with synthetic transaction claims and normal roles. `npm run test:data-api` adds real local signed-JWT PostgREST 13.0.7 and API/SDK transport checks (**24 assertions**), using ephemeral in-memory keys and loopback-only provider traffic. Both destroy their disposable containers; the latter also removes its dedicated network. There is no hosted schema apply, native Clerk integration, persistent key or personal-profile upload.

Cryptographic session tests serve a local ephemeral JWKS and verify actual signatures with the official Clerk backend SDK public-key path. Invalid session categories and before-read rejection are tested independently from SQL; injected SQL claims alone are not JWT verification evidence.

See [implementation report](../../docs/gate8a7c1-implementation-report.md) and [manual setup checklist](../../docs/gate8a7c1-setup-runbook.md). Hosted C1 remains **NOT RUN — MANUAL ACTION REQUIRED**. C2/C3, live calendar, final integrated owner acceptance and 8B are not delivered.

## Configured-audience correction — 2026-10-05

`source-manifest.json` now attributes the corrected executable tree. `audience-correction-results.json` records its red/green and final validation. The exact published head is recorded in [draft PR #180](https://github.com/dezrobbo1/life-rhythm-prototype/pull/180), avoiding a recursive documentation hash.

`test/fixtures/audienceCases.ts` shares one 18-case matrix between real ephemeral RSA/Clerk API tests and the actual local PostgREST harness. With `audience: issued`, 15 rows require 401 and zero provider reads; three matching string/array rows require 200 and one read. Existing no-audience sessions remain supported. Reproduce with `npm run test:server` and `npm run test:data-api` (now **60 assertions**, including the original 24).

The 14 browser rows in `results.json` and the prior PostgreSQL grants/forced-RLS matrix retain their original attribution to head `0b32f60cbe8a7808897c2908224c3dd60b8cd920` / fingerprint `463103fa4ad8c1a283c8a2fcecad55ae9281a228a14198ff997ee0d6725f02b3`. They are reused only for unchanged browser/client and SQL boundaries: no `app/src`, SQL/migration, browser fixture/replay, lockfile or CI source changed. Synthetic browser responses do not exercise the server verifier; refreshed signed API/Data API tests establish this correction. The earlier Perth suite remains historical timezone evidence; no scheduling/date/shared-schema behavior changed. This reuse is not native hosted trust or C1 PASS.
# Bounded native ESM and sign-in corrections — 2026-10-06

Same unmerged draft PR180, input `d35242d5b4a066ae111841934c5223bd0271c513`; exact new published head is in the PR/handoff. Final executable manifest: **312 files**, `477ea8f48ef6ddd7c8eac3e8defa2b186d0d58fe78dd8407358181854b4729e4`.

- [Native ESM results](native-esm-correction-results.json): real emitted-function startup red/green, Node22/24 HTTP/typechecks and 60 isolated signed Data API assertions; no hosted PASS.
- [Sign-in results](signin-layout-results.json) and [real-browser replay](signin-layout.spec.ts): two widths, focus/tab order, dimensions, busy/error states using actual SDK/intercepted synthetic HTTP. Run `npx --no-install playwright test --config playwright.c1-signin.config.ts`; screenshots replay into `/tmp/life-rhythm-c1-signin-screenshots`, never into the repository.
- Final combined UTC suite: 1,627 tests / 122 files PASS; build and client privacy PASS. [Report](../../docs/gate8a7c1-implementation-report.md) keeps both scopes distinct and identifies native acceptance still pending. No new full 18/18 browser claim; prior independent fixture-timing caveat remains.

---
