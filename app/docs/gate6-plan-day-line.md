# Gate 6C — Plan + Day Line v0

Status: bounded Gate 6 implementation slice.

This milestone makes Plan understandable before the user opens scheduler detail. It does not change scheduling authority, persistence semantics, navigation, Today, Held, Capture, Reduced Day, Minimum Done, re-entry, recurrence, or calendar-write boundaries.

## Product outcome

Plan now opens with a read-only **Day Line** assembled from current canonical planning facts for the selected date.

The Day Line may show:

- fixed external commitments, including read-only calendar commitments;
- the assigned day profile's explicit work period and its exact planning-use rule;
- protected or unavailable Life Shape time;
- ask-first time;
- explicit available blocks as possible space;
- current scheduler-owned flexible private placements;
- current user-confirmed private placements.

Rows are chronological and use the Gate 6 Soft Ledger grammar.

## Truth boundary

Blank calendar time is never rendered as usable capacity.

Only an explicit `available` Life Shape block is allowed to appear as possible planning space. A missing Day Line row means only that no relevant recorded fact exists for that interval; it does not mean Life Rhythm owns the gap.

Work periods are shown as context with the actual `workPlanningUse` meaning. A work-period row does not itself claim that the whole period is available capacity.

Current user-confirmed placements come from the canonical live scheduling projection, not from the accepted scheduler snapshot. This matters when a lifecycle/placement write succeeds but a best-effort automatic repair cannot update the scheduler plan: the Day Line must still show the real saved user placement, and must not revive a removed one from stale scheduler state. Scheduler-owned automatic rows remain sourced from the accepted persisted scheduler plan.

The Day Line reads the live scheduling context with `readOnly: true` and reads persisted scheduler-plan state. It does not repair, build, move, or write merely to render.

If the Day Line read fails, the failure is visible and the existing detailed Plan remains available. Retry is read-only.

## Day selection

Without a Pool-to-Plan date hint, Gate 6C opens on the browser's current local date rather than a hard-coded weekday.

A Pool-to-Plan date remains authoritative when supplied. The visible Day Line selector then supplies the selected local date to the existing detailed `PersonalPlanScreen`, so Day Line and detailed Plan remain aligned.

`PersonalPlanScreen` keeps its existing standalone behaviour by default. When explicitly hosted by the Gate 6C surface, it omits its own duplicate screen heading and Day Shape selector; the Day Line wrapper owns those two presentation controls. Detailed Plan state and actions remain unchanged.

## Detailed Plan capabilities preserved

The existing detailed Plan remains reachable below the Day Line, including:

- automatic private plan detail;
- refresh/repair;
- Changed;
- one-step Undo;
- Day Shape boundaries;
- optional manual soft suggestions;
- user-confirmed placements;
- truthful manual-data load/partial/failure states.

The read-only calendar source control remains on Plan and stays aligned to the shared Gate 6 content width.

## Explicit exclusions

Gate 6C does not:

- alter scheduler feasibility or ranking;
- add a calendar grid;
- infer capacity from blank gaps;
- change external calendar data;
- remove manual placement capability;
- change Plan persistence;
- change navigation;
- introduce Held or global Capture;
- redesign Today into Now / Later / Changed;
- merge Pool and Library;
- add behavioural learning or AI.

## Review boundary

The bounded pre-merge review checked Day Line truth against current canonical state, selected-date behaviour, work-period visibility, the no-write read boundary, and embedded Plan accessibility. Concrete findings are corrected in the same PR; no second broad review cycle is required.

## Next Gate 6 slice

After this milestone, the intended next bounded slice is Today → Now / Later / Changed, using the same truthful-state and Soft Ledger foundation.
