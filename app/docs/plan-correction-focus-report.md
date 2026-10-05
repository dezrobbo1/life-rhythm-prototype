# Plan correction focus: narrow post-merge B3 correction

Date: 2026-10-05 UTC. Status: implemented and locally verified; draft publication, independent targeted verification and BoB's gate-qualified merge remain separate. No merge by this task.

## Boundary and source

The late [#175 review finding](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4186367782) arrived after #175 merged. B3 keyboard acceptance is reopened only for missing/delayed Plan correction-row focus. Accepted B3 changes remain. C1 waits for this correction. Docs-only #177 is independently reviewed and untouched; #168/#160 stay open. No backend, credentials, persistence contracts, scheduler, navigation redesign, roadmap change or broad review.

Verified plugin-authoritative main/base: `f98cca4424cc482407fea1b2862d0d79a3c9a7b2`; root tree `456429bca51bf1459d17076f01c4f81b0d2fa885`; accepted app source tree `0a1170ed53e231fee701a39c49768d3dad7cf180`. Local HEAD/root/source matched. Branch: `fix/plan-correction-focus-fallback`, a new branch/PR from merged main. Final head is in PR metadata rather than a self-referential report field.

Corrected app source tree: `0c0083ea70e8f42bba9b2f4b1a1bf35dee6114d1`. Runtime paths/bytes SHA-256: `27e03248a630a467fcbeceb88c4af8420c4c3b47681b005d869889b65f2ca2d5`. [Manifest](../evidence/gate8a7b3/manifest.json) and [results](../evidence/gate8a7b3/post-merge-focus-results.json) identify source, viewport, browser, time/timezone and build hashes. Application files were unchanged after final validation.

Selected route: GPT-6.1 Sol / Medium, Standard, supplied by delegation because the prior asynchronous focus correction remained incomplete and Luna was unavailable by capacity. No higher reasoning escalation or credential repair.

## Reproduction and correction

Activate Protect on an automatic Day Line row. A successful coordinator result predicts a correction ID; private-plan state removes the old focused control before Day Line publishes the successor. If its subscription delays, stays loading or errors, the old fallback skips focus merely because an ID is predicted. No successor ref runs, so focus lands on BODY despite the saved protection. Production frequency is unknown; no data loss was demonstrated. The accepted pre-merge 8/8 replay did not hold this ordering.

The rendered tests and Chromium delayed-delivery fixture fail on the baseline screen: expected connected Plan details, actual BODY. [Red-first summary](../evidence/gate8a7b3/post-merge-focus-red.json) preserves the diagnostic outcome. The new matrix also revealed Move's modal cleanup ignored cancellation during an in-flight save; three added tests failed against the initial correction and pass with the final shared cancellation handling.

Correction summaries register mounted elements. A layout effect runs after React commits refs/DOM and selects the exact connected successor or connected Plan details fallback. The same request can restore a later successor while the user has not moved on. No focus timer or assumption about subscription latency remains. Keyboard/pointer input and selected-date navigation cancel the request; a version captured before the save prevents later async completion from recreating it. Move modal cleanup shares the connected destination and preserves cancellation. Protect/Unprotect, same/cross-day Move, repair-pending fallback and existing persistence/lifecycle authority remain intact.

## Fresh validation

| Check | Outcome |
| --- | --- |
| Rendered `PersonalPlanReadState.test.tsx` | PASS: 39 tests, including 15 added ordering/cancellation cases |
| `TZ=UTC npm test` | PASS: 111 files / 1,405 tests |
| `TZ=Australia/Perth npm test` | PASS: 111 files / 1,405 tests on sequential rerun |
| `npm run build` | PASS: TypeScript and Vite |
| Scoped cloud-browser replay | PASS: 11/11 affected rows, zero runtime page errors, overflow checks pass |
| `node --check app/evidence/gate8a7b3/replay.cjs` | PASS |
| Root `git diff --check` / staged diff check | PASS |

The first Perth full run timed out after 5 seconds in `Gate6DailyLoopAcceptance.test.tsx` (“captures safely, plans factual work, preserves Minimum, and returns the task to Held without debt”) while UTC/Perth suites and build/browser work ran concurrently. UTC passed; the unchanged Perth suite passed on a sequential rerun. No timeout or assertion was weakened. This transient failed run is disclosed rather than omitted.

The browser ran Chromium `151.0.7922.173`, Playwright `1.62.1`, Australia/Perth, synthetic isolated profiles, running clock anchored to `2026-10-05T01:00:00Z` (09:00 Perth), 390×844 mobile and 1280×844 desktop. Fresh results recorded at `2026-10-05T17:03:53.550Z`. It served fingerprinted local Vite source; separately built output hashes are recorded. This is cloud-browser evidence under merged #176, not hosted or physical-mobile acceptance. The agent-browser CLI was unavailable; the installed cloud Playwright/Chromium runtime executed the replay.

The nine new rows control only browser delivery of the compiled Day Line subscriber callback, with real React lifecycle/coordinators/IndexedDB. Explicit release proves safe delayed restoration; loading/error delivery proves connected fallback. Keyboard/pointer/date-navigation cases prove no late theft. Real stored corrections are checked, including the existing removed-protection lifecycle. Before/after snapshots of soft placements, scheduler plan, task pool, task history and calendar sources are identical across focus/inspection/release. Two uninstrumented affected rows retain immediate successor, Protect/Unprotect, same-day/cross-day Move, later navigation, saved fallback/no-write, deduplication, rhythm conflict/Cancel/modal trap/duration/reload evidence. No inspection writes occur; synthetic seeding and correction actions are explicit fixture writes.

Existing accepted rows/results and dated reports remain unchanged. Unrelated completion/exploratory rows were not rerun. Screenshots produced by the existing affected rows remain local, with hashes in results; screenshot delivery is not claimed. Hosted deployment, production frequency and final integrated owner acceptance remain outside this evidence.

## Handoff

Publish one small draft PR. Parent reuses the existing independent reviewer for targeted verification of this focus matrix and final exact-source gates, without a new broad review. Reply to the original late thread with the PR/evidence link and leave it unresolved until independent verification/merge. BoB performs any gate-qualified merge. #175 stays merged; #177 and #168/#160 are untouched. No C1 work began.
