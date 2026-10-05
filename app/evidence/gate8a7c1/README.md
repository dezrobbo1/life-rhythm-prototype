# C1 local synthetic evidence

Base: `b58b7442c478770f9c0e1db9b6208c8c8e803e30`. Local implementation is unmerged; exact PR head is in the draft PR/handoff. `source-manifest.json` attributes the executable tree (including tests, fixtures, configs, lockfile and app CI). Markdown/evidence JSON are excluded to avoid recursive hashes. Reproduce with `npm run source:manifest`; do not reuse evidence after executable source changes.

Browser replay: `npm run test:browser:c1` from `app`. Playwright 1.63.0 uses Chromium 151.0.7922.173 on Linux in this cloud environment. Each row runs at 390×844 and 1280×844 in an isolated browser context. `replay.spec.ts` gives exact actions/assertions. The test server aliases Clerk to `clerk-fixture.tsx` and intercepts metadata responses; those are **synthetic**, never native provider acceptance. Production imports/config are unchanged by the alias and no fixture entry is included in `dist`.

Seven rows per viewport: required missing configuration; signed-out landing/keyboard; healthy device-only content and sign-out; API 401/403/426/503 and keyboard retry; loading plus late A response after B switch. The first row combines missing/signed-out checks; the healthy row covers no-body GET transport and overflow. Total **14 browser tests**; all passed on the fingerprinted source. `results.json` retains compact outcomes/runtime/source attribution. No screenshot/build binary is committed or claimed delivered.

SQL: `npm run test:database` runs the forced-RLS/grants matrix from `supabase/tests` against a fresh real PostgreSQL 17.11 engine, with synthetic transaction claims and normal roles. `npm run test:data-api` adds real local signed-JWT PostgREST 13.0.7 and API/SDK transport checks (**24 assertions**), using ephemeral in-memory keys and loopback-only provider traffic. Both destroy their disposable containers; the latter also removes its dedicated network. There is no hosted schema apply, native Clerk integration, persistent key or personal-profile upload.

Cryptographic session tests serve a local ephemeral JWKS and verify actual signatures with the official Clerk backend SDK public-key path. Invalid session categories and before-read rejection are tested independently from SQL; injected SQL claims alone are not JWT verification evidence.

See [implementation report](../../docs/gate8a7c1-implementation-report.md) and [manual setup checklist](../../docs/gate8a7c1-setup-runbook.md). Hosted C1 remains **NOT RUN — MANUAL ACTION REQUIRED**. C2/C3, live calendar, final integrated owner acceptance and 8B are not delivered.
