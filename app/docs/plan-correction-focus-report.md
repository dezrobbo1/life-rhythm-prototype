# Plan correction focus: narrow post-merge B3 correction

Date: 2026-10-05 UTC. Status: existing PR #178 remains unmerged. The consolidated focus-lifecycle correction is recorded below; independent targeted verification and BoB's gate-qualified merge remain separate.

## Boundary and source

The late [#175 review finding](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4186367782) arrived after #175 merged. B3 keyboard acceptance is reopened only for missing/delayed Plan correction-row focus. Accepted B3 changes remain. C1 waits for this correction. Docs-only #177 is independently reviewed and untouched; #168/#160 stay open. No backend, credentials, persistence contracts, scheduler, navigation redesign, roadmap change or broad review.

Verified plugin-authoritative main/base: `f98cca4424cc482407fea1b2862d0d79a3c9a7b2`; root tree `456429bca51bf1459d17076f01c4f81b0d2fa885`; accepted app source tree `0a1170ed53e231fee701a39c49768d3dad7cf180`. Local HEAD/root/source matched. Branch: `fix/plan-correction-focus-fallback`, a new branch/PR from merged main. Final head is in PR metadata rather than a self-referential report field.

First publication app source tree: `0c0083ea70e8f42bba9b2f4b1a1bf35dee6114d1`. Runtime paths/bytes SHA-256: `27e03248a630a467fcbeceb88c4af8420c4c3b47681b005d869889b65f2ca2d5`. [Manifest](../evidence/gate8a7b3/manifest.json) and [results](../evidence/gate8a7b3/post-merge-focus-results.json) identify source, viewport, browser, time/timezone and build hashes. These are dated first-publication results, preserved below; the latest source/evidence is in the consolidated correction section.

Initial selected route: GPT-6.1 Sol / Medium, Standard, supplied by delegation because the prior asynchronous focus correction remained incomplete and Luna was unavailable by capacity. That first turn had no higher escalation or credential repair. The parent selected GPT-6.1 Sol / High for this correction: repeated Medium passes missed/introduced ordering failures in the shared mechanism and exact-head review reported a concrete unresolved P1. This is a justified one-level escalation for correctness, not task length or access.

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

Initial publication created draft PR #178 at `d9448dbe6291f892d72bf8264e3903b4781bcc8f`. Continue that existing PR for the consolidated correction; do not create another branch/PR. Parent reuses the existing independent reviewer for targeted verification of this focus matrix and final exact-source gates, without a new broad review. Reply to the original late thread with the PR/evidence link and leave it unresolved until independent verification/merge. BoB performs any gate-qualified merge. #175 stays merged; #177 and #168/#160 are untouched. No C1 work began.


## Consolidated focus-lifecycle correction — 2026-10-05 UTC

Reviewed head: `d9448dbe6291f892d72bf8264e3903b4781bcc8f`; base/main still `f98cca4424cc482407fea1b2862d0d79a3c9a7b2`. [New material finding](https://github.com/dezrobbo1/life-rhythm-prototype/pull/178#discussion_r4186789058), thread `PRRT_kwDOS5UAoc6pI8Cz`: **Block before merge — confirmed.** Pending Move plus Tab/click among enabled modal inputs changes the old document focus version. Successful close captured a soon-disconnected input as the return target; the original opener could also be removed or remain focused instead of the correction destination. Chromium reproduced BODY focus on this exact production head. No data loss was demonstrated.

One bounded matrix treats focus as ownership of an asynchronous correction. A request object has saving/saved phases and its interaction surface. Input inside the saving correction remains part of the action; genuine external input or selected-day navigation clears ownership. Successful completion may promote only that same request. After DOM commit, the connected exact successor wins, otherwise Plan details provides the fallback. A delayed successor follows only while ownership remains active. Once saved, subsequent keyboard/pointer input cancels delayed restoration. While saving, connected owned controls keep their focus; if a live read removes that owned surface before result delivery, the same DOM-commit rule immediately recovers to Plan details. Four strengthened red cases reproduced BODY before this pending-phase recovery. Failed actions discard unpromoted ownership and keep existing connected controls/modal focus.

Move's close chooses a connected return after refs commit. An input inside the closing dialog cannot be preserved as an external destination. A connected external control retains focus; if a captured destination is disconnected by close/row replacement, Plan details is the return fallback. The shared Modal implementation is unchanged. Numeric version bookkeeping is removed rather than supplemented with another timeout/exception. Protect/Unprotect use the same ownership rule, including input in the affected correction disclosure while saving. Scheduling, command arguments, canonical writes, profile authority, repair/lifecycle semantics and navigation structure remain unchanged.

Current app source tree: `5e81e3cfbd80b39f10b91933d4387adfc36b6194`. Runtime SHA-256: `9bb8f8a0968dc669c73a1e311c6ee64b349d810df0dc69dd5e2def8c8f537db9`. [Current manifest](../evidence/gate8a7b3/manifest.json), [lifecycle red evidence](../evidence/gate8a7b3/focus-lifecycle-red.json), and [lifecycle results](../evidence/gate8a7b3/focus-lifecycle-results.json) identify exact source and runtime. The original 11-row post-merge results and all earlier accepted evidence remain dated, unchanged files.

| Bounded state/ordering class | Rendered/browser coverage |
| --- | --- |
| Pending Move, internal Tab/click; immediate/delayed/missing successor; same/cross day; replaced/stable opener ID | 24 rendered + 24 browser combinations; connected correct-row/Plan details return, safe delayed restoration, cancellation after close |
| Genuine external keyboard/pointer/date navigation during pending save | All three actions; prior blurred-external cases retained; nine added connected-external cases keep that destination and cancel late row focus |
| Pending Protect/Unprotect input in their own correction disclosure | Eight rendered success/failure cases; four browser success cases; recovery before pending result delivery plus shared fallback/restoration; failed action keeps connected focus |
| Rejected pending Move with internal Tab/click | Two rendered + two real-domain browser rejections; modal remains open and focused; Cancel returns to connected opener; no writes |
| Existing immediate/loading/error/delayed row, after-save cancellation, same/cross-day Move, conflict/Cancel, rhythm, reload and saved fallback | Original focused regressions retained and directly affected browser rows rerun; no broad acceptance review |

Red-first: the first exact-head matrix failed 24/80 rendered cases; the four shared Protect/Unprotect success cases also exposed the same ownership gap before its correction. Two additional pointer-focus failures in that intermediate test run were jsdom fixture behavior: summary click did not focus the summary, so the fixture explicitly places focus after the real pointer event. Assertions and events were retained. Final rendered file passes **88/88** (49 new cases in this continuation; no prior regression removed or weakened). [Red summary](../evidence/gate8a7b3/focus-lifecycle-red.json) records before/after context.

Fresh final checks: `TZ=UTC npm test` and `TZ=Australia/Perth npm test` each pass **111 files / 1,454 tests**. The full suites ran sequentially; no failure in these final runs. `npm run build` passes (existing large-bundle advisory), replay syntax and root/staged diff checks pass. Browser lifecycle matrix: **42/42 PASS**, zero runtime page errors and overflow checks pass; Chromium 151.0.7922.173 / Playwright 1.62.1; 390×844 and 1280×844; Perth running clock. Result timestamp: `2026-10-05T17:54:58.961Z`. Build hashes match the final validated TypeScript/Vite build..

The browser fixture controls real ordering without production test hooks: loopback routing substitutes only compiled UI coordinator invocations and Day Line delivery. For Move, the real coordinator completes before UI result delivery is released, so the user interacts with the still-open pending modal after real persistence. For Protect/Unprotect, command start is held until the within-correction input occurs; then the real command/result runs. Day Line loading/error/hold delivery is independent. Inspection/input/result release cause no extra writes in compared soft-placement/scheduler-plan/pool/task-history/calendar tables. Actual correction commands remain explicit fixture writes; real rejected Moves preserve the baseline byte-for-byte.

A browser replay correction changed the cancellation key from ArrowRight to Shift because Chromium's select changed Monday to Tuesday; the old assertion incorrectly waited for Monday's row afterward. Date navigation remains separately tested. The first within-correction browser fixture waited to click Why after the real command had already removed that row through live data, so that command start is now explicitly held for the intended pending-input ordering. A later no-write comparison caught queued automatic task repair changing derived Plan metadata after the real Move command. The fixture now observes in-flight Plan reads, repair markers and unchanged complete snapshots across DOM frames before establishing the inspection baseline; it suppresses no writes and removes no compared fields. These were bounded fixture corrections, not production changes or weakened assertions.

No new broad Codex review request is issued. Publish this consolidated correction on PR #178, reply with exact head/evidence, and leave verification/resolution to the parent's targeted pass. No merge, provider/account/C1 work, credentials change, rollout or issue closure. #177 remains independently reviewed and untouched. #168/#160 and integrated readiness remain unchanged.
