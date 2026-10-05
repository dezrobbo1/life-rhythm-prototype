# Gate 8A7B3 populated daily surface and contextual correction

Status: B3 ordinary convergence accepted and PR #175 merged; see the dated post-merge completion below. Earlier evidence remains dated and attributable. A later post-gate focus finding awaits parent disposition.
Date: 2026-10-05. Source/base: `add82b74082f3bf347191d6ce97de2816169f4eb` (PR #174).
Evidence continuation reconciled with policy merge `c2ee838163497938e84b0a2044f3dc4ad961c2b6` (PR #176). Reviewed application commit: `b1ae38bc56bf6f1205e9163fa3c3e81536cd753d`; application source tree `5bc78ca338faea7362bb6b7afcfc8d03631d834d`.
Branch: `feat/gate8a7b3-today-plan-relief`. Exact published head is recorded in PR metadata/body; this report does not manufacture a self-referential commit SHA.

## Bounded implementation

Approved outcome: one useful current action, quiet Later/Changed, reachable correction and clearly distinguished relief. This follows PRODUCT.md and MVP_PLAN.md's B3 boundary, with the existing deterministic state owners.

- Today TaskCard separates a useful primary Start/Resume/Minimum/Stop action from secondary continuation, Pause, Start Boost, Park, Not today and Details. Authored Minimum text/minutes stay visible; achieving Minimum continues to count through continuation. Unsupported task placeholders are removed.
- Day Line remains first. Its private rows disclose existing Move, Protect/Unprotect and grounded Why handlers through a render slot supplied by the single PersonalPlanScreen owner. Embedded detailed lists omit copies of those correction rows. Fixed/external rows have no correction controls. Maintenance stays in Plan details; material conflict attention and feedback remain outside it.
- Move uses the existing shared Modal with labelled local date/start inputs, preserved-duration copy, Save/Cancel, visible conflict feedback, Escape/cancel focus return and focus on the refreshed logical row after successful correction. Existing coordinator authority, recovery generation and conflict fencing are unchanged.
- Relief varies its primary action and consequence copy by zero/one/multiple visible Today tasks. Narrow Today marks extras not today; Park extras parks them. Neither is scheduler Reduced Day. Restart shows the first task's authored Minimum/minutes as an explicit preview and performs no start/completion write. Busy actions are guarded. History export/typed-confirmation deletion remain under explicit disclosure with inputs kept mounted; unsupported restore/tomorrow/full-reset prototypes are absent.
- Scoped CSS retains content-sized stacked controls and wrapping at mobile width, including Today, contextual Move, Reduced Day and re-entry. No scheduler policy, schema, migration, navigation lifecycle, account/provider, or legacy runtime change.

Implementation sequence: regressions for action hierarchy, unsupported/disclosed Relief, contextual correction, conflict and focus return; minimal UI changes; focused verification; full tests/build/timezone controls; cloud browser; unmerged handoff and draft publication. One fresh independent engineering review subsequently returned MERGE at the reviewed application commit with no confirmed code findings (task `01a10c81-9d18-71f3-a0ea-cc2ecc2fa03a`). This completion pass requests only targeted evidence verification through the parent.

## Automated evidence

Final implementation-source validation from `app` at the reviewed application commit (reused for this evidence/documentation continuation because application files, dependencies, configuration and tests are byte-identical):

| Command | Result |
| --- | --- |
| `TZ=UTC npm test` | PASS — 111 files, 1,384 tests |
| `TZ=Australia/Perth npm test` | PASS — 111 files, 1,384 tests |
| `npm run build` | PASS — TypeScript and Vite; existing large-bundle advisory remains |
| Root `git diff --check` | PASS |

Failing regressions preceded hierarchy/disclosure/contextual correction implementation. A further regression demonstrated Move conflict feedback needed to be inside the modal and successful Move needed logical-row focus after placement identity changed. Obsolete Reset-heading/disabled-Minimum assertions were updated to the approved Relief/useful-action behavior. The existing lifecycle test now waits for Park to be enabled before clicking it; making Park reachable in idle state means presence alone no longer establishes action readiness. No safety assertion was removed.

The full runs include TodayScreen, TodayChangedPersistence, TodayReadRecovery, TodayBoundaryRecovery, MinimumAchievementPersistence, ReentryActionsPersistence, PlanDayLineScreen, PlanScreen, RenderedRecoveryAdditional, ResetScreen, Modal, calmSurfaceRegression, Gate6DailyLoopAcceptance, correction coordinator, Reduced Day, rhythm, settings and portable recovery coverage. Existing unchanged persistence/Now-Later-Changed, midnight/read-failure, stale/conflict/repair, rhythm correction and Undo matrices remain exercised rather than rewritten merely for styling.

Harness corrections: fixed local wall-clock time for the new integrated test so Perth's actual late evening does not remove today's future capacity; advance that test clock between successful repairs. A fully frozen browser Date caused timestamp-based scheduler event ID collisions during repeated repair. The final cloud browser uses a running clock anchored to 09:00 Perth. These were harness corrections; scheduler/event rules were not changed.

## Cloud browser evidence

Actual cloud Chromium `151.0.7922.173`, Playwright through the installed runtime (agent-browser CLI unavailable). Fresh isolated browser context, throwaway IndexedDB data, Australia/Perth, running local date/time anchored to 2026-10-05 09:00. Desktop 1280×900 and mobile viewport 390×844. This is a cloud browser, not the owner's physical mobile or operating-system keyboard.

Observed PASS: populated Today and factual Later; Capture save/reload; contextual task Move rejection in the modal and successful preserved-duration move; Protect/Unprotect/Why with maintenance closed; Escape return; Start/Minimum/continuation/Pause/Resume; Reduced Day preview/apply/return with genuine Changed; truthful Relief preview and history disclosure preserving an unsaved confirmation; mobile wrapping/no horizontal overflow; dated re-entry choices; configured rhythm edit and generated occurrence surfaces (linked execution remains automated/B2 evidence); seven weekdays/work/usable-day inputs; downloaded portable export and checked uploaded file. Portable restore was not applied in this browser run; destructive/stale recovery remains covered by isolated automated tests. No runtime page errors were recorded.

The original local `gate8a7b3-browser-evidence.zip` contains the following supporting screenshots. **It was not remotely delivered**: Library upload and one bounded retry failed at tool discovery before preparation. Screenshot binaries are not committed. Their names/hashes and sanitized replay/results are now durable under [evidence](../evidence/gate8a7b3/README.md):

- `today-desktop.png`, `today-minimum-desktop.png`, `today-mobile.png`;
- `plan-context-desktop.png`, `plan-move-conflict-desktop.png`, `plan-move-mobile.png`;
- `reduced-day-preview-desktop.png`, `today-changed-reduced-desktop.png`, `reentry-mobile.png`;
- `relief-desktop.png`, `relief-mobile.png`;
- `rhythm-config-mobile.png`, `settings-planning-mobile.png`, `portable-check-mobile.png`;
- `browser-report.json` and replay script. Throwaway exported profile JSON is excluded from the local archive and from the repository.

Browser screenshots come from the reviewed application source on local Vite. Original immutable preview `https://life-rhythm-prototype-5yyl73gl8-daler-project-lr.vercel.app` (deployment `dpl_BxKjBdhyptWncbFhoUchkzf1Fyqp`) became READY with metadata attributing `b1ae38bc56bf6f1205e9163fa3c3e81536cd753d`. Hosted cloud-browser navigation was **BLOCKED** at the proxy by `net::ERR_TUNNEL_CONNECTION_FAILED` before rendering. This report claims local exact-source runtime verification, not hosted interaction or physical-device acceptance.

## Dated policy and evidence reassessment — 2026-10-05

The original report required a physical/owner walkthrough for every row and an intermediate subjective-burden decision. The owner's explicit direction is now durable in merged policy [PR #176](https://github.com/dezrobbo1/life-rhythm-prototype/pull/176), main `c2ee838163497938e84b0a2044f3dc4ad961c2b6`, [MVP_PLAN acceptance evidence policy](../../MVP_PLAN.md#acceptance-evidence-policy) and [HUMAN_GATES](../../docs/HUMAN_GATES.md). Approximately 390px reproducible cloud-browser evidence can satisfy ordinary intermediate responsive, flow, keyboard/focus, overflow, persistence and exact-source criteria. Only an identified behavior the cloud cannot represent requires a device-specific check. B3's intermediate subjective-burden owner check is waived; no owner PASS is invented. Final integrated 8A8 owner-trial subjective judgment and true manual gates remain.

The fresh independent engineering reviewer reproduced Capture/save/reload, task Move conflict/no-write/duration/Escape/opener/success-row focus, Protect/Unprotect/Why, Minimum/continuation/pause/resume and Relief preview/disclosure input at 390×844 in Chromium 151 with a running Perth clock. It returned **MERGE**, no confirmed code findings, at the reviewed application commit. That verdict predates this evidence-only continuation; parent independently verifies these specific additions next.

[Executable completion replay](../evidence/gate8a7b3/replay.cjs), [manifest](../evidence/gate8a7b3/manifest.json), [observed row results](../evidence/gate8a7b3/row-results.json), and [run instructions](../evidence/gate8a7b3/README.md) provide the remotely inspectable reproduction route. The new harness actually executed: **7/7 rows PASS**, zero runtime page errors, no horizontal overflow. Chromium `151.0.7922.173`, Playwright `1.62.1`, Australia/Perth; mobile 390×844 and desktop 1280×844; running clock anchored to `2026-10-05T01:00:00Z` (09:00 Perth), explicitly advancing between repair writes. Every scenario uses a fresh isolated context with synthetic fixtures. The harness refuses application fingerprint mismatch.

Runtime source SHA-256: `d389265450ee09d77709a4cf15e7d6a1dbf67326e96997a58b5f11e128384a9a`. It covers sorted tracked `app/src`, public, package/lock, index and TypeScript/Vite configuration paths/bytes, including existing tests, excluding documentation/evidence. The policy integration and evidence additions preserve that fingerprint and the reviewed `app/src` Git tree. Results also record separately validated build-output hashes; browser assertions run against the fingerprinted local Vite source, not the production preview. No application test suite or build was rerun for this source-unchanged continuation; valid UTC/Perth 1,384-test/build evidence above is reused.

Harness development corrected expectations for trimmed authored inputs and actual placement fields. Reduced Day now establishes a normal plan first and isolates its fixture from background rhythm-occurrence materialization, so preview/no-write compares a settled baseline. These are replay-fixture corrections; no product defect was confirmed and no product code/test was changed.

## Current intermediate acceptance rows

At evidence preparation, PASS below identified observed engineering/browser evidence and final B3 acceptance was pending parent verification. The dated post-merge completion below now records that decision; prior B2 owner acceptance is not substituted for this evidence.

| Row | Evidence route and observed result | Current disposition |
| --- | --- | --- |
| Mobile Capture | Independent reviewer at 390×844: save/reload and reachable controls; earlier replay available | Browser PASS; independent evidence retained |
| Mobile Task edit | New replay: 209-character title, 195-character Minimum, focused inputs, 7 authored minutes, scroll-reachable Save/Cancel, cancel/no-write, save/status preservation, opener return and reload; mobile + desktop | Browser PASS |
| Populated Today | Earlier replay and independent reviewer: idle/start/Minimum/continuation/pause/resume; truthful Later and hierarchy; terminal/empty/busy/read-failure/midnight matrices remain covered by unchanged suites | Checked browser states PASS; edge-state tests reused |
| Contextual correction | Independently checked task controls; new rhythm conflict/no-write/cancel, local start/duration/save/reload, successful-row focus, Protect/Unprotect/Why, preserved linked identity and external records | Browser PASS |
| Repair and Undo | New replay: real saved Reduced Day repair produces Changed; one eligible Undo restores placements and mode together, persists across reload; persistent-correction fencing remains in unchanged tests | Browser PASS; safety regression evidence reused |
| Reduced Day and re-entry | New preview/no-write/trap/Escape/return/apply/Undo/normal-return/reload; prior dated explicit re-entry choices/no catch-up and unchanged re-entry suites | Browser PASS for checked paths |
| Relief | New zero/multiple Narrow and Park cases, no deletion, reload, resulting one-task preview and no-op; earlier history disclosure input and safety suites for stale/partial failure | Browser PASS; safety regression evidence reused |
| Rhythm setup/execution | Earlier B2 configuration/edit/generated-occurrence surfaces, with execution covered by unchanged suites (the original browser-summary overstatement is corrected in prior-results); independent reviewed source unchanged; new contextual correction validates linked provenance/reload | Earlier browser and automated evidence retained |
| Seven-day/life shape/static snapshot | Earlier mobile seven weekday/work/usable-day surfaces; reviewed B2 controls and unchanged Settings/calendar tests; no new live-calendar claim | Existing bounded evidence retained |
| Portable recovery | Earlier browser export and uploaded-file check; explicit throwaway replacement safeguards/stale recovery covered by isolated tests. Portable replacement was not applied in this browser pass | Browser export/check PASS; recovery safety tests retained, no browser replacement claim |
| Desktop/keyboard | New mobile/desktop Enter/Space activation, Tab/Shift+Tab trap, 3px visible focus outline, Save/Cancel return and persistence; earlier disclosure/Escape observations | Browser PASS |
| Objective calm-surface criteria | One useful primary action, quiet Later/Changed, contextual correction, preview-only Relief versus scheduler Reduced Day, wrapped/stacked mobile controls; screenshots inspected and new no-overflow/flow assertions passed | Objective evidence recorded; targeted verification pending |
| Subjective burden | Intermediate owner check waived by merged policy; final integrated owner-trial subjective judgment remains | WAIVED for B3 intermediate check; no owner PASS |

## Remaining limits and gates

- Parent must independently verify the specific evidence additions, exact application-source equivalence and reconciled policy before disposition. This task performs no GitHub merge and creates no second implementation PR or broad review.
- The screenshot ZIP/PNGs remain local. Names/hashes are supporting attribution only; source replay/results are the durable reproducible deliverable. The original replay was already executed; portable adjustments and a corrected observation label received syntax validation and were not broadly rerun.
- Hosted navigation remains blocked as recorded above; local Vite/browser checks do not claim hosted-runtime acceptance. No specific unresolved B3 device-only behavior was reproduced. An OS software keyboard was not emulated; any subsequently identified device-specific failure must retain its own required evidence.
- Preserve #168/#160 open and historical observed FAIL records until the authorized acceptance disposition; no B3 final acceptance or 8A8 PASS is declared here. Account continuity 8A7C, live read-only calendar 8A7D, final integrated 8A8 and owner longitudinal 8B gates remain. #146 remains separate.


## Consolidated confirmed-review correction — 2026-10-05 UTC

Correction parent/head: `aaa0a31ae26fd2e174ef45b780df553698f6d3a4`. Reverified live main/base: `c2ee838163497938e84b0a2044f3dc4ad961c2b6`; it is already an ancestor of the continuation. Same branch/PR #175; no merge. Corrected `app/src` tree: `0a1170ed53e231fee701a39c49768d3dad7cf180`. Runtime paths/bytes SHA-256: `36ef6075013f99b54804f0f7cf015ad908e00e8b459951388cf957db64be49cb`. Exact published correction head is recorded in PR metadata/body; the report avoids a self-referential commit SHA.

The completed built-in Codex review at the parent head added two focus blockers to the independently confirmed CodeRabbit read-fallback blocker. All three were verified and consolidated in this pass; external review text was evidence, and no suggested third-party tooling or new broad review was invoked.

| Finding | Confirmed consequence and correction |
| --- | --- |
| [Saved correction fallback](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4185271735) | Day Line failure previously hid every corrected manual placement from details too. Details now deduplicate only exact placement IDs actually represented by ready Day Line rows. Loading/error/absent rows retain readable saved title/time; partial manual reads retain readable items. Existing accepted-plan/action guards remain. |
| [Cross-day Move focus](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4185731172) | Off-screen Move removed the opener and left a logical pending target. A successful Move has an explicit connected destination: the exact same-day successor when available, otherwise Plan details. Cancel retains opener return. Date navigation clears pending requests. |
| [First Protect focus](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4185731189) | Automatic first Protect remounted a keyed row and lost its button. Protect/Unprotect prepare focus for the exact result placement ID or a stable Plan details fallback. A request survives the asynchronous row refresh sequence, then clears on the next keyboard/pointer action or selected-date change. It cannot be consumed by an obsolete row or steal focus after the user moves on. |

The bounded matrix covers loading/error versus represented/absent Day Line rows; successful and partial manual reads; normal deduplication; unavailable accepted-plan guards; same-day and cross-day Move; conflict/cancel/no-write; first automatic Protect; existing corrected Protect/Unprotect; repeated successor remounts; next keyboard action and destination-date navigation without stale focus theft. Scheduler/coordinator semantics, persisted schema and migrations were not changed.

Regression evidence: the new focused tests were replayed against exact original source at `aaa0a31`; six assertions failed (manual fallback for successful/partial reads, ID forwarding, disconnected-opener fallback, cross-day Move, and automatic Protect). The corrected focused set, including Gate 6 integrated focus and repeated-remount/no-theft assertions, passes **4 files / 41 tests**. No safety assertion was removed. A concurrent full run hit an existing 5-second acceptance timeout; isolation passed. A later full run exposed the extra row-remount race and drove the final focus-request correction; final runs follow below.

Final corrected-source validation (no concurrent browser load; two workers, unchanged assertion/time limits):

| Command / evidence | Result |
| --- | --- |
| `TZ=UTC npm test -- --maxWorkers=2` | PASS — 111 files / 1,390 tests |
| `TZ=Australia/Perth npm test -- --maxWorkers=2` | PASS — 111 files / 1,390 tests |
| `npm run build` | PASS — TypeScript/Vite; existing bundle-size advisory |
| Complete `node app/evidence/gate8a7b3/replay.cjs` | PASS — 8/8 rows; zero page errors; mobile 390×844 / desktop 1280×844; Chromium 151.0.7922.173, Playwright 1.62.1; advancing clock anchored to 2026-10-05 09:00 Perth |
| `node --check` for replay; root staged/unstaged `git diff --check` | PASS |

The fresh run records the parent checkout commit plus the exact corrected working-source tree/fingerprint above. The published correction has those same application bytes; it does not relabel the old reviewed commit as the corrected source. Build hashes are in `row-results.json`; browser interaction served fingerprinted local Vite source.

The browser uses fresh synthetic contexts and fingerprinted loopback Vite source. Its extra Plan row explicitly corrupts then removes only its synthetic calendar-source fixture to exercise read failure; persistence snapshots during fallback inspection remain byte-identical. Original seven-row results remain in [pre-correction-row-results.json](../evidence/gate8a7b3/pre-correction-row-results.json), and refreshed results/manifest/replay remain in `app/evidence/gate8a7b3`. New screenshots remain local supporting files; no screenshot delivery is claimed.

Model route: initially GPT-6 Luna / Medium under route B. The platform failed with “Selected model is at capacity. Please try a different model.” Parent resumed the same workspace on GPT-6.1 Sol / Medium as the next available route. This was an availability fallback, not a reasoning escalation.

At correction publication, parent targeted verification and the final gate remained pending, and PR #175 was open/unmerged. The following dated completion records the subsequent parent decision. No integrated 8A8 PASS or 8B commencement follows from this correction.


## Post-merge completion — 2026-10-05

Parent accepted B3 ordinary calm-surface convergence under merged policy #176 and directly merged [PR #175](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175), head `bfa8c08275a4a3819775a3dfeca928099031e4dc`, main/merge `f98cca4424cc482407fea1b2862d0d79a3c9a7b2`. The [final gate comment](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#issuecomment-5998704908) at 16:31:38 UTC records independent targeted PASS for all three supported corrections and resolution of those three threads. Independent cloud task `01a10c81-9d18-71f3-a0ea-cc2ecc2fa03a` verified 41 focused tests and corrected 8/8 browser rows at 390×844 and desktop with no page errors or overflow. Chromium 151.0.7922.173, Playwright 1.62.1 and synthetic advancing-clock Perth fixtures are recorded above/in the durable replay.

Accepted runtime fingerprint: `36ef6075013f99b54804f0f7cf015ad908e00e8b459951388cf957db64be49cb`; corrected `app/src` tree `0a1170ed53e231fee701a39c49768d3dad7cf180`. App CI #398 passed 1,390 tests/build; App Preview #621 and Vercel passed on that final source. Full UTC and Perth 1,390-test runs were reported by the author; this documentation task does not claim to have rerun them. [Manifest/replay/results](../evidence/gate8a7b3/README.md) remain the source-controlled evidence route. Screenshots remain undelivered; no attachment or physical-device/subjective owner PASS is invented.

| Tracker / scope | Post-B3 disposition |
| --- | --- |
| #168 ordinary B1/B2/B3 convergence | Satisfied by recorded bounded acceptance. Keep open in this task; parent closes only after durable completion docs review/merge and disposition of the late finding below. |
| #160 ordinary flow/focus/overflow/persistence and rhythm execution | Satisfied by accepted B evidence on the attributed source. These scoped results do not certify every integrated path. |
| #160 cleared-core-hours | Not independently demonstrated in browser; pending integrated 8A8 on an identified build. |
| #160 recurring static-calendar import/status/buffer browser controls | Not independently demonstrated; pending integrated 8A8. Static ICS is still a snapshot/fallback, not the 8A7D live-calendar prerequisite. |
| Historical 3 October owner evidence | Retains partial observed FAIL and attribution limitations. No historical FAIL report is rewritten as PASS. |

**Later live finding:** at 16:34:11 UTC, after the recorded final gate, an automated review posted [Protect successor never mounts](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4186367782). The live thread is unresolved and alleges that a predicted successor can leave focus on the document if Day Line stays loading/errors. The existing code queues a predicted placement ID and only invokes the details fallback when no target is queued; this documentation task has not reproduced or adjudicated the combined failure case. Preserve the accepted parent gate as dated fact, surface this later finding for parent disposition and do not describe all current threads as resolved. No new broad review, application fix or issue closure is launched here.

Next approved milestone is 8A7C; its [C1 contract](gate8a7c1-account-boundary-contract.md) defines the proposed verified account/server boundary. Account-backed continuity, one live read-only calendar, genuine provider/account authorization and final integrated owner judgment/trial remain required. Gate 8A8 stays **BLOCK**, Gate 8B has not started and baseline/Day 1 are not authorized. #160 remains open for its pending integrated rows; no PASS by omission.
