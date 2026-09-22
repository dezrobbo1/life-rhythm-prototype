# Gate 6 exit report — v0 daily loop

Gate 6 is **PASS**. Repository evidence plus desktop, keyboard, and owner-provided approximately-390-pixel portrait mobile-browser acceptance show a coherent ordinary daily loop without requiring the user to understand Pool status, placement machinery, solver concepts, or internal persistence boundaries.

## Tested source

- Starting main: `8455080d10ba64a4fac4edd593ec7575a1e02b50`
- Branch: `agent/gate6f-v0-daily-loop-acceptance`
- Published implementation/test head: `e44caa586c7f0d01f7607ddc2fbbb0d4ff30d99b`
- Tested implementation/test tree: `db2b99f7f234313d0a9d80b2b856f748c510af47`

The report correction after that tree is documentation-only. The final published head and tree are recorded in PR #147 and the delivery handoff.

Final mobile acceptance was supplied by the owner as a portrait browser recording of current `main` at `1ecf410b00ad1161d2bfca72b9b079ba23534787`. The recording is qualitative acceptance evidence; no precise CSS viewport width is claimed.

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
| Gate 6F | The connected daily loop was exercised, calendar-repair attention was made durable across reload, and final approximately-390-pixel portrait mobile-browser acceptance passed. |

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
| Approximately 390 px browser | PASS | The owner-provided portrait mobile-browser recording of current main exercised Today/Now/Later, persistent bottom navigation, Capture with the mobile keyboard, Held, Library, Plan Day Line and Plan details, Settings forms and scrolling, Start Boost, Start/Pause/Resume, Minimum Done and continuation, Reduced Day, Park/return to Held, and repeated primary navigation. No horizontal page overflow or clipped primary action was observed; bottom navigation, keyboard-backed forms/modals, vertical scrolling, and the ordinary daily-loop actions remained usable. The visible calendar/planning warning was truthful application state, not a responsive-layout failure. |
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

Successful canonical repairs using the current calendar snapshot clear pending attention. While the marker is present, Today keeps its task and readable fixed/user-confirmed facts usable but hides stale automatic placements and Changed metadata behind a targeted warning. Its Retry repair action now runs that canonical repair and retains the warning plus the returned error when recovery fails. Undo of a successful calendar repair re-marks the restored pre-calendar private plan as pending because Undo does not repair the changed calendar context. App's scheduler-state live observation advances Today's read generation on later pending-state transitions and when its first observation is already pending, closing the bootstrap race without authorising a build, repair, or write.

Scheduler persistence now also compares one deterministic snapshot of every persisted input projected into an automatic decision: settings/Life Shape, active tasks, task-pool items, rhythm templates, and soft placements. The expected scheduler record, including Reduced Day mode, and the calendar source remain separately authoritative. If a high-level build or semantic repair loses that boundary, it rebuilds the complete live context and recalculates at most once. Time-disruption maintenance reruns clipping and disruption detection from the fresh state; initial creation accepts a plan that won concurrently; Reduced Day apply/return recompute once; and Undo remains tied to its exact accepted history rather than being replayed against newer state.

## Automated evidence

- Gate 6 daily-loop acceptance test in isolation: 1 file, 1 test passed.
- Focused final correction matrix: 12 files, 182 tests passed.
- Default full suite: 76 files, 893 tests passed.
- UTC full suite: 76 files, 893 tests passed.
- Australia/Perth full suite: 76 files, 893 tests passed.
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
- Issue #141 remains open as governance wording for schema-compatible next-milestone guidance.
- Issues #146 and #141 do not prevent Gate 6 exit.
- Exact-head desktop and keyboard walkthroughs passed through a temporary authenticated preview path. The owner-provided approximately-390-pixel portrait mobile-browser walkthrough of current main also passed.
- The existing production bundle-size advisory remains non-blocking and unchanged.

## Decision

**GATE 6 EXIT — PASS**

Desktop acceptance passed, keyboard acceptance passed, and approximately-390-pixel portrait mobile acceptance passed. The user can operate the ordinary daily loop without understanding scheduler internals. Gate 7 — Behavioural Learning v0 is the next development milestone and has not begun.
