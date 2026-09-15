# Gate 6D — Today: Now, Later, Changed

Gate 6D makes the personal Today screen a calm read surface over the existing task and scheduler authorities. It does not add a scheduler, ranking rule, capacity source, or persistence schema.

## Now authority

`Now` keeps the existing Today task-selection authority. The same persisted active task that the prior Today surface selected remains the dominant `TaskCard`, with its lifecycle, durable Minimum achievement, Details, Start Boost, Park, Not today, and re-entry selection behaviour intact.

A hard external commitment that is currently in progress may appear as concise read-only context. It does not replace the active task, write to the calendar, or become a task.

## Later truth boundary

`Later` reuses the Gate 6C Day Line composition. For the current local date it admits only unelapsed:

- hard external commitments;
- current user-confirmed private placements from live canonical input;
- scheduler-owned placements from the persisted accepted private plan.

The current task and any current commitment already shown in `Now` are not repeated. The first four facts are shown in chronological order; remaining facts are summarized for Plan.

Blank gaps, possible-space blocks, ask-first time, protected time, work context, and unplanned catalogue rhythms are not Later facts. Their absence never means a gap is scheduling capacity.

## Changed truth boundary

`Changed` appears only when the latest persisted scheduler repair contains actual `moved`, `added`, `removed`, or `variantChanged` records. Titles come from current canonical task and rhythm lookup data. The persisted repair trigger and reason ground calm attribution; Reduced Day is never inferred from day mode alone.

The section uses the existing mode-aware one-step Undo. Reduced Day controls retain invocation and mode ownership, while this generic section owns durable latest-change presentation. When there are no actual change records, no dominant Changed section is rendered.

## Read isolation and refresh

Opening Today performs read-only live-context and saved-plan reads. It never builds or repairs a plan merely to render. A missing plan cannot fabricate flexible work. An invalid plan is not described as an empty day.

Task reads and optional plan/context reads fail independently: a readable `Now` task remains usable when Later or Changed cannot be read. Monotonic request generations prevent an older async plan read from replacing newer facts. Today refreshes after its own lifecycle repairs, Reduced Day actions, Undo, and the app's existing background plan-revision signal.

## Preserved and demoted capabilities

Reduce today remains adjacent to Now, including preview, recomputation, date-scoped mode, Return to normal, and coherent Undo. Re-entry remains a compact `Needs a choice` surface with the existing user-confirmed actions and no catch-up debt.

Add one-off remains a quiet Now action. Today task backup export and the read-only checker remain reachable under `More / Recovery`; restore is still not connected. Presentation-only `Today feels`, `planAdjustedLine`, and the unplanned personal rhythm preview no longer act as personal Today facts. Their mock fixtures remain available to example and component code.

## Explicit exclusions

Gate 6D does not change scheduler algorithms, recurrence, elapsed-time clipping, Reduced Day policy, lifecycle persistence, database schemas, external-calendar write boundaries, navigation, global Capture, Held, or Gate 6 design beyond Today.

The next Gate 6 slice may continue navigation or information-architecture work after this milestone is independently reviewed and merged.
