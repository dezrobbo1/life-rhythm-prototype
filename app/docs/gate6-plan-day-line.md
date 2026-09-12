# Gate 6C — Plan + Day Line v0

Status: bounded Gate 6 implementation slice.

This milestone makes Plan understandable before the user opens scheduler detail. It does not change scheduling authority, persistence semantics, navigation, Today, Held, Capture, Reduced Day, Minimum Done, re-entry, recurrence, or calendar-write boundaries.

## Product outcome

Plan now opens with a read-only **Day Line** assembled from current canonical planning facts for the selected date.

The Day Line may show:

- fixed external commitments, including read-only calendar commitments;
- protected or unavailable Life Shape time;
- ask-first time;
- explicit available blocks as possible space;
- current scheduler-owned flexible private placements;
- current user-confirmed private placements.

Rows are chronological and use the Gate 6 Soft Ledger grammar.

## Truth boundary

Blank calendar time is never rendered as usable capacity.

Only an explicit `available` Life Shape block is allowed to appear as possible planning space. A missing Day Line row means only that no relevant recorded fact exists for that interval; it does not mean Life Rhythm owns the gap.

The Day Line reads the live scheduling context with `readOnly: true` and reads persisted scheduler-plan state. It does not repair, build, move, or write merely to render.

If the Day Line read fails, the failure is visible and the existing detailed Plan remains available. Retry is read-only.

## Day selection

Gate 6C adds one visible Day Line selector. It supplies the same selected local date to the existing detailed `PersonalPlanScreen`, so Day Line and detailed Plan remain aligned.

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

## Next Gate 6 slice

After this milestone, the intended next bounded slice is Today → Now / Later / Changed, using the same truthful-state and Soft Ledger foundation.
