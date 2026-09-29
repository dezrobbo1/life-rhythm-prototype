# Gate 8A5 — Scheduling Mutation Integrity + User Corrections V0

Status: implementation contract for draft PR #164.

Verified base: `main` at `87e5923cf5fb15d9d6be7619bf9fc01f31355fc0` (PR #163 merged).

## Purpose

Gate 8A5 closes the integrity gap between canonical scheduling inputs, accepted private-plan state and direct user correction.

The required invariant is:

> A successful scheduling-affecting canonical write must either leave an accepted private plan consistent immediately or durably mark that accepted plan for repair before the canonical write is reported as committed.

A user must also be able to correct an individual private placement without silently changing external calendar truth or bypassing hard feasibility.

## Authority boundary

Canonical scheduling authority remains structured local data. The accepted scheduler plan remains derived state.

Low-risk private scheduling may be repaired automatically. User corrections are stronger than ordinary scheduler ranking and inertia, but they do not override:

- hard external commitments;
- explicit unavailable/protected capacity;
- elapsed/past time;
- hard timing/usefulness constraints;
- invalid rhythm occurrence identity.

The external calendar remains read-only.

## Mutation integrity

Production scheduling mutations use the existing specialized repair-attention model rather than one generic dirty bit.

| Mutation class | Canonical state | Gate 8A5 integrity path |
| --- | --- | --- |
| Setup / Life Shape | settings | existing settings repair attention in same transaction |
| Calendar import/remove/buffers | calendar source | existing calendar repair attention in same transaction |
| Explicit preference add/edit/remove/reset | explicit-preference settings sidecar | existing preference repair attention and exact targets |
| Duration control save/reset | duration-control settings sidecar | duration-learning repair attention is written atomically with the control change |
| Behaviour-history deletion | trusted behaviour ledger | duration-learning repair attention is written atomically when trusted events are deleted |
| Capture / Today creation / task definition correction | Pool / ActiveTask | task-input repair attention |
| General task lifecycle | ActiveTask / Pool / soft placements | task-input repair attention for ordinary intentions; exact rhythm-instance repair attention for generated occurrences |
| Pool deferral / direct Pool status write | Pool | task-input repair attention |
| Manual placement create/remove/status | soft placement / Pool | task-input repair attention |
| Rhythm configuration/state/generation/routing | rhythm template/plan/revision/instance | existing rhythm-input repair attention |
| Reduced Day / return to normal | accepted scheduler plan + day-mode context | direct coordinated plan write; no separate canonical input is invented |
| Overrun / missed-start repair | accepted scheduler plan | direct rolling repair from current canonical input |
| Scheduler-plan writes | derived plan only | canonical/calendar/duration snapshots and recovery generation prevent stale commit |
| Behaviour events with no scheduling consequence | factual history | no repair marker unless the event changes duration-learning authority |

Repair attention is part of the same IndexedDB transaction as the canonical mutation where the mutation can invalidate an already accepted plan. Marker persistence failure therefore aborts/rolls back that canonical mutation.

A failed later automatic repair does not revert the user's canonical change. Repair attention remains durable and stale automatic placement facts are not treated as current authority.

## Low-level repositories

Some low-level repository functions remain callable for tests/compatibility, but current production UI mutation paths use their coordinating repositories.

Examples:

- explicit-preference UI uses the preference mutation coordinator;
- duration-control UI uses the duration mutation coordinator;
- calendar UI uses the calendar mutation coordinator;
- current rhythm UI uses Gate 8A2 rhythm authority rather than the older template-only compatibility repository.

Gate 8A5 does not rewrite compatibility APIs that are not production scheduling entry points.

## Persistent correction authority

Gate 8A5 reuses `softPlacements` as the canonical correction record instead of promoting `schedulerPlanState`.

Optional correction metadata distinguishes:

- `move`;
- `protect`;
- `moveProtected`.

Ordinary intentions retain their stable intention/task ID.

Concrete rhythm corrections additionally retain:

- rhythm template ID;
- rhythm plan ID;
- recurrence revision ID;
- rhythm instance ID.

A rhythm correction applies only to that concrete occurrence. It does not alter recurrence, frequency, template configuration or future instances.

No database version bump is required because the correction fields are optional additions to the existing record schema.

## Move

Move is an explicit exact-coordinate command.

The correction:

1. starts from the exact rendered accepted placement;
2. carries the recovery generation associated with that rendered plan;
3. rechecks the accepted placement and current canonical/calendar snapshots;
4. preserves the placement duration/form;
5. rejects elapsed time or a destination outside current candidate authority;
6. validates hard scheduler constraints at the requested destination;
7. persists durable user-confirmed correction authority;
8. marks the relevant task/rhythm input for repair;
9. repairs the flexible private plan around that correction.

Life Rhythm does not silently choose a different destination after a rejected Move.

A factual `userPlacementMoved` behaviour event records the move. It does not infer why the user moved it or convert the move into a learnt preference.

## Protect / Unprotect

Protect means:

> keep this private placement here during ordinary automatic repair.

Protection is stored in the canonical correction record; transient `pinnedPlacementIds` remains only a rolling-repair mechanism and is not treated as user persistence.

Ordinary repair projects the correction as `existingUserConfirmed` authority.

If harder reality later makes the protected coordinate invalid, the scheduler rejects that persisted placement and suppresses automatic relocation of the same target. The correction remains saved for the user to resolve rather than being silently moved or deleted.

Unprotect removes protection authority.

- A moved-and-protected placement becomes a moved correction.
- A protection-only correction can return to scheduler-owned placement authority without restoring an obsolete canonical input.
- Terminal lifecycle transitions close/remove live correction placement state so dead work cannot remain scheduled only because it was previously protected.

A dedicated Protect inference event is deliberately not introduced in Gate 8A5. The explicit correction record itself is canonical factual provenance. No preference or psychological meaning is inferred.

## Why this time?

Gate 8A5 reuses the existing deterministic `placementReasonLines(...)` path.

The UI may expose only reasons present in the accepted placement provenance, including:

- explicit Prefer/Avoid handling;
- actual candidate interval use;
- task form and duration choice;
- rhythm preferred day/time where actually used;
- learnt or user-corrected duration where actually applied;
- explicit Move;
- explicit Protect.

No LLM is used to generate placement reasons. Internal IDs, solver/debug metadata and psychological explanations are not shown.

## Undo

Existing one-step scheduler Undo remains plan-level and is offered only when restoring the prior accepted plan does not contradict current canonical authority.

Undo remains blocked/withheld for repairs that consumed changed:

- settings;
- task input;
- rhythm input;
- preference authority;
- duration-learning authority.

Calendar repair Undo retains the pre-existing behavior that reopens calendar repair attention rather than pretending the external calendar reverted.

Persistent Move/Protect corrections are not offered plan-only Undo in V0 because their canonical correction record would otherwise remain inconsistent with a restored earlier plan. The user corrects them through Move/Protect/Unprotect instead.

Arbitrary history traversal is out of scope.

## Concurrency and recovery

Move, Protect and Unprotect are rendered-state commands.

The command carries the Gate 8A4 recovery generation that preceded the rendered read. If another handle restores the namespace before commit:

- the command rejects;
- no correction row is written;
- no scheduler plan is overwritten;
- old intent is not replayed against the restored profile.

The correction transaction also verifies:

- the rendered accepted placement is still exact;
- canonical scheduling input snapshot still matches;
- calendar source snapshot still matches.

The later scheduler repair uses the normal stale-plan commit guard.

## Portable recovery

Correction metadata remains inside the existing portable profile's `softPlacements` class.

Existing Gate 8A4 portable-v1 backups without correction fields remain valid because those fields are optional.

New backups preserve Move/Protect authority.

For a live rhythm occurrence corrected by the user:

- the correction soft-placement carries the exact occurrence identity;
- the RhythmInstance may link its `placementId` to that correction record;
- the same coordinate is not duplicated into the scheduler-only `routedRhythmPlacements` adjunct;
- restore writes canonical correction authority first and lets normal scheduling rebuild the accepted plan from it.

Full `schedulerPlanState` remains non-portable.

## UI boundary

Gate 8A5 adds compact placement correction affordances in Plan:

- Move;
- Protect this time / Unprotect;
- Why this time?

Move uses labelled date/time controls and explicit Save/Cancel. There is no drag-only interaction.

This is not the Gate 8A7 navigation/copy redesign.

## Deferred

Gate 8A5 does not:

- infer preferences from moves;
- add completion-variant learning;
- add AI scheduling or explanation;
- write external calendar events;
- add a generic event-sourcing layer;
- add arbitrary multi-step Undo;
- close issue #160;
- start the Gate 8B longitudinal trial.
