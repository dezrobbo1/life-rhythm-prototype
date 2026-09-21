# Gate 6 exit report — v0 daily loop

Gate 6 remains **NOT YET**. Repository and exact-head desktop evidence show a coherent ordinary daily loop without requiring the user to understand Pool status, placement machinery, solver concepts, or internal persistence boundaries. The required approximately-390-pixel browser acceptance could not be executed with the available viewport controls, so this report does not promote that bounded evidence to a complete Gate 6 exit.

## Tested source

- Starting main: `8455080d10ba64a4fac4edd593ec7575a1e02b50`
- Branch: `agent/gate6f-v0-daily-loop-acceptance`
- Published implementation/test head: `46d5f1fe5621babe7cbdd2f27c4118908003b8b1`
- Tested implementation/test tree: `4a85800f98f753f69e64826e694a3d24ac050011`

The report correction after that tree is documentation-only. The final published head and tree are recorded in PR #147 and the delivery handoff.

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
| Gate 6F | The connected daily loop was exercised, calendar-repair attention was made durable across reload, and final mobile browser acceptance remains open. |

## Exit matrix

| Area | Result | Repository-backed evidence |
| --- | --- | --- |
| Daily orientation | PASS | Today renders one dominant Now object, factual Later rows, and omits Changed when no persisted change exists. Gate 6D truth-model and component suites remain green. |
| Capture | PASS | The connected App test captures one item into Held, stays on Today, and verifies that no active task, soft placement, or calendar source is created. |
| Held | PASS | The same journey adds the captured item to Today and later parks it back into Held using the real linked lifecycle repositories. Existing defer, Not today, No longer needed, and Plan-handoff suites remain green. |
| Plan | PASS | Day Line is the visible default; protected, ask-first, fixed, and accepted private facts retain their truth boundaries. Plan details remain closed by default and can be opened and closed without changing scheduler authority. |
| Automatic repair | PASS | Existing scheduler, Today, Plan, Changed, and Undo persistence suites remain green. A saved calendar change whose repair fails remains visible after reload and in an already-mounted Today until a later canonical repair succeeds. Marker-write failure stops repair, stale concurrent plan writes are rejected, Today suppresses stale automatic-plan facts while repair is pending, and Undo of a calendar repair restores pending attention. |
| Reduced Day | PASS | Existing preview/apply, persisted date-scoped mode, Changed, Undo, Return to normal, reload, and next-date suites remain green in both required time zones. |
| Minimum Done | PASS | The connected journey exercises Start, Minimum Done, Keep going, Pause, Resume, and Park, then verifies durable `minimumAchievedAt` in the real active-task record. Existing reload coverage remains green. |
| Re-entry | PASS | Existing real-repository and Today suites preserve usefulness-based choices, exact Try Minimum selection, and the no-catch-up boundary. Rendering review remains read-only. |
| Failure and trust | PASS | Gate 6 read-health suites remain green. The Gate 6F calendar-attention regressions prove failure survives an App remount, propagates through Dexie to an already-mounted Today, and clears there only through a later successful persisted repair. |
| Desktop browser | PASS | An authenticated exact-head Vercel preview was exercised at 1363 px. Today, Capture, Held, Plan, Library, Settings, task lifecycle, durable Minimum, Reduced Day preview/apply, and mode-aware Undo were operable. Primary surfaces had no horizontal overflow and no application-origin console errors. |
| Approximately 390 px browser | NOT TESTABLE IN AVAILABLE ENVIRONMENT | The exact-head browser was reachable, but the available browser runtime exposed no viewport-resize capability and no installed local browser path was available. Automated responsive/accessibility coverage passed, but it is not reported as a browser pass. This is the remaining Gate 6 exit blocker. |
| Keyboard browser journey | PASS | The exact-head walkthrough used keyboard activation for primary navigation, Capture, Held handoff, Plan details, Today Details, Start Boost, Reduced Day, and Undo. Capture Escape restored focus to its trigger. |

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

Gate 6F stores an optional validated `calendarRepairPendingAt` marker in the existing scheduler-plan state record. No database version, table, index, or migration changed. Calendar-source changes persist that marker in the same Dexie transaction as the source mutation. Repairs then carry the exact calendar source snapshot used to build their scheduling input and compare both that snapshot and the previously read scheduler record inside a transaction spanning `calendarSources` and `schedulerPlanState`. A concurrent source mutation or plan write therefore rejects the stale result before it can overwrite the plan or clear attention. The same compare-and-save boundary protects initial plan creation and Undo.

Successful canonical repairs using the current calendar snapshot clear pending attention. While the marker is present, Today keeps its task and readable fixed/user-confirmed facts usable but hides stale automatic placements and Changed metadata behind a targeted warning. Its Retry repair action now runs that canonical repair and retains the warning plus the returned error when recovery fails. Undo of a successful calendar repair re-marks the restored pre-calendar private plan as pending because Undo does not repair the changed calendar context. App's scheduler-state live observation now advances Today's read generation only when the durable pending boolean changes, so both pending and cleared states propagate to an already-mounted Today without authorising a build, repair, or write.

## Automated evidence

- Gate 6 daily-loop acceptance test in isolation: 1 file, 1 test passed.
- Focused final correction matrix: 9 files, 176 tests passed.
- Default full suite: 74 files, 882 tests passed.
- UTC full suite: 74 files, 882 tests passed.
- Australia/Perth full suite: 74 files, 882 tests passed.
- Build: TypeScript and Vite production build passed.
- Diff check: passed.

The Gate 6 acceptance assertion now scopes `Quiet reset` to the labelled Day Line ledger. The same title may truthfully appear elsewhere, so the test identifies the intended semantic surface instead of assuming globally unique copy.

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
- Exact-head desktop and keyboard walkthroughs passed through a temporary authenticated preview path. The approximately-390-pixel walkthrough remains unverified because neither the exact-head browser runtime nor the local environment exposed a supported resize-capable browser. Automated responsive/accessibility evidence is green, but no mobile browser pass is inferred.
- The existing production bundle-size advisory remains non-blocking and unchanged.

## Decision

**GATE 6 EXIT — NOT YET**

The single remaining exit blocker is execution of the required approximately-390-pixel browser acceptance on the exact published tree (or an explicit owner decision to accept the unavailable evidence). Gate 7 has not begun.
