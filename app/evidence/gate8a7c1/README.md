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
