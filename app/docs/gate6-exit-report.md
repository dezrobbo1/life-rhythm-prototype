# Gate 6 exit report — v0 daily loop

Gate 6 exits with a **PASS**. The ordinary daily loop is coherent without requiring the user to understand Pool status, placement machinery, solver concepts, or internal persistence boundaries. The conclusion is bounded to the implemented v0 surfaces and the evidence below; it is not a claim that every scheduler or time-zone edge is solved.

## Tested source

- Starting main: `8455080d10ba64a4fac4edd593ec7575a1e02b50`
- Branch: `agent/gate6f-v0-daily-loop-acceptance`
- Locally tested implementation/test head: `489a9cf10d02a8126fc8aec67947d886753c042a`
- Published equivalent head: `096572b8bcd05f90525a5d3fb64ca24f7ebb5487`
- Shared source tree: `1cc0414523e2978f1c6aabab076e31a12a1eaf32`

The implementation and published commits have different commit IDs because the authorized GitHub connector created the published commit, but their tree IDs are identical. This report and the small delivery-status update are documentation-only changes after that tested source tree. Their publication head and tree are recorded in PR #147 and the delivery handoff.

## Gate 6 progression

| Slice | Delivered boundary |
| --- | --- |
| Gate 6A | Personal collection reads distinguish loading, empty, partial-invalid, and failed states. |
| Gate 6B | Shared calm visual hierarchy and accessible interaction foundation. |
| Gate 6C | A truthful, read-only Plan Day Line that does not treat blank gaps as capacity. |
| Gate 6D | Today presents Now, factual Later, and persisted Changed information. |
| Gate 6E0 | Library custom-rhythm reads remain truthful without hiding the built-in catalogue. |
| Gate 6E1 | Pool became the user-facing Held surface and Capture became persistently reachable. |
| Gate 6E2 | Day Line became the default Plan product; detailed machinery moved behind Plan details without changing scheduler authority. |
| Gate 6F | The connected daily loop was accepted and calendar-repair attention was made durable across reload. |

## Exit matrix

| Area | Result | Repository-backed evidence |
| --- | --- | --- |
| Daily orientation | PASS | Today renders one dominant Now object, factual Later rows, and omits Changed when no persisted change exists. Gate 6D truth-model and component suites remain green. |
| Capture | PASS | The connected App test captures one item into Held, stays on Today, and verifies that no active task, soft placement, or calendar source is created. |
| Held | PASS | The same journey adds the captured item to Today and later parks it back into Held using the real linked lifecycle repositories. Existing defer, Not today, No longer needed, and Plan-handoff suites remain green. |
| Plan | PASS | Day Line is the visible default; protected, ask-first, fixed, and accepted private facts retain their truth boundaries. Plan details remain closed by default and can be opened and closed without changing scheduler authority. |
| Automatic repair | PASS | Existing scheduler, Today, Plan, Changed, and Undo persistence suites remain green. Gate 6F additionally fixes the one exit blocker found: a saved calendar change whose repair fails remains visible after reload until a later canonical repair succeeds. |
| Reduced Day | PASS | Existing preview/apply, persisted date-scoped mode, Changed, Undo, Return to normal, reload, and next-date suites remain green in both required time zones. |
| Minimum Done | PASS | The connected journey exercises Start, Minimum Done, Keep going, Pause, Resume, and Park, then verifies durable `minimumAchievedAt` in the real active-task record. Existing reload coverage remains green. |
| Re-entry | PASS | Existing real-repository and Today suites preserve usefulness-based choices, exact Try Minimum selection, and the no-catch-up boundary. Rendering review remains read-only. |
| Failure and trust | PASS | Gate 6 read-health suites remain green. The Gate 6F calendar-attention regression proves failure survives an App remount and clears through a later successful persisted repair, not through a local callback alone. |
| Desktop browser | NOT TESTABLE IN AVAILABLE ENVIRONMENT | The exact-head Vercel preview deployed successfully but redirected the connected browser to protected Vercel sign-in, and no advertised browser-auth capability was available. Localhost was blocked from the connected browser. |
| Approximately 390 px browser | NOT TESTABLE IN AVAILABLE ENVIRONMENT | No supported browser with viewport control could reach the exact-head application. Automated responsive/accessibility coverage passed, but it is not reported as a browser pass. |
| Keyboard browser journey | NOT TESTABLE IN AVAILABLE ENVIRONMENT | The protected preview prevented exact-head interactive keyboard acceptance. Component tests still cover modal focus restoration, keyboard-operable disclosures, and accessible actions, but they are not reported as a browser walkthrough. |

## Connected daily-loop scenario

The focused Gate 6 acceptance test uses the production `App` with real fake-IndexedDB repositories. It seeds a synthetic Life Shape with fixed, protected, ask-first, and explicit-capacity facts plus a daily rhythm. The journey then:

1. opens Today and verifies Now, Later, and the absence of a false Changed section;
2. uses persistent Capture and confirms the new item is Held only;
3. opens Held and brings the exact item to Today;
4. opens Plan, inspects the Day Line, and opens and closes Plan details;
5. returns to Today and exercises Start, Minimum Done, continuation, Pause, and Resume;
6. parks the task and verifies the same identity is safely Held with Minimum achievement intact.

Dedicated integration suites cover the state-heavy continuations that are unsafe or brittle to force through one wall-clock browser journey: repair/Changed/Undo, Reduced Day apply/undo/normal and date scoping, re-entry actions without tomorrow debt, reload reconstruction, truthful read failure, and scheduler-plan persistence. Together these tests exercise the daily system rather than replacing persistence boundaries with mocks.

## Gate 6F blocker and correction

Acceptance found one concrete trust blocker inherited from the merged calendar-attention correction: after a calendar source was saved and private-plan repair failed, the attention state lived only in React memory. Reload could therefore show a changed calendar beside a stale private plan without the warning.

Gate 6F stores an optional validated `calendarRepairPendingAt` marker in the existing scheduler-plan state record. No database version, table, index, or migration changed. Calendar-source changes mark the plan pending before repair; successful canonical plan writes clear the marker; plan-only Undo preserves it because Undo does not repair the changed calendar context. A live read keeps Plan attention current across routes, reload, and successful repairs from any canonical path.

## Automated evidence

- Focused affected matrix: 16 files, 230 tests passed.
- Default full suite: 73 files, 864 tests passed.
- UTC full suite: 73 files, 864 tests passed.
- Australia/Perth full suite: 73 files, 864 tests passed on the fresh rerun.
- Build: TypeScript and Vite production build passed.
- Diff check: passed.

The first Perth full attempt exposed a timing-only failure in the untouched `AppSettingsPersistence.test.tsx`. That file passed immediately in isolation under Perth, and the complete Perth suite then passed without a code change. It is recorded as an execution flake, not hidden as a product failure.

## Bounded qualitative review

- Normal Today use does not require scheduler terminology.
- Capture asks for a safe holding fact rather than immediate organisation.
- Held copy and actions represent safe memory, not backlog debt.
- Plan is understandable with details closed; repair controls remain available when correction is needed.
- Changed is conditional and grounded in persisted before/after facts.
- No new scheduler, priority, recurrence, external-calendar-write, or catch-up mechanism was introduced.

## Known limitations and follow-ups

- Issue #146 remains open. Spring-forward nonexistent local times and fall-back ambiguous internal placement times do not yet have the promised DST-safe boundary semantics. Gate 6F used ordinary non-transition dates and does not close or weaken that issue.
- Issue #141 remains open as governance wording for schema-compatible next-milestone guidance. It does not block the product acceptance result.
- Exact-head desktop, approximately-390-pixel, and keyboard browser walkthroughs remain unverified because deployment protection and unavailable local browser tooling blocked the supported paths. Automated interaction and accessibility evidence is green, but no browser pass is inferred.
- The existing production bundle-size advisory remains non-blocking and unchanged.

## Decision

**GATE 6 EXIT — PASS**

No unresolved Gate 6 surface blocker remains in repository evidence. Gate 7 is the next planned milestone, but this report does not begin Gate 7 implementation.
