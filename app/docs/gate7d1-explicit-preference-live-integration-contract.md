# Gate 7D1 — explicit preference live integration foundation

## Boundary

Gate 7D1 connects the Gate 7C preference foundation to live deterministic scheduling without yet exposing a production preference editor.

This slice adds:

- validated explicit-preference reads inside the scheduler's existing consistent local-data transaction;
- whole-horizon preference rules that retain absolute lifetime boundaries;
- per-candidate preference lifetime evaluation in the candidate timezone;
- the Gate 7C precedence hierarchy at the slot-ranking boundary;
- explicit handling of equal-authority contradictions without silently selecting one side;
- target-scoped optimistic mutation expectations for the future live editor;
- durable preference-repair attention tied to the accepted private plan;
- bounded automatic repair of future scheduler-owned placements affected by changed preference targets.

It does not add inferred preferences, confidence/decay learning, behavioural prediction, AI/ML, natural-language preference capture, external-calendar writes, or the final “What Life Rhythm has learnt about me” interface.

## Live read and fail-closed behaviour

`buildCurrentLiveSchedulingContext` reads the explicit-preference sidecar in the same IndexedDB read transaction as settings, canonical task/rhythm/placement rows, calendar state and the accepted scheduler state.

A missing sidecar means there are no stored explicit preferences. A malformed or unreadable sidecar is different: live scheduling fails visibly and does not manufacture an empty preference set.

The existing canonical scheduling-input snapshot already includes every row in the shared settings table. The explicit-preference sidecar therefore participates in stale-plan write detection without adding a database version, object store or index.

## Scheduler lifetime semantics

Gate 7C's single-instant adapter remains unchanged. Gate 7D1 adds a whole-horizon projection for live scheduling that retains:

- `activeFrom` from the preference's persisted `updatedAt`;
- optional absolute `expiresAt`;
- the explicit-persistent precedence source;
- declared weekday and local-clock scope;
- user-declared provenance.

The deterministic scheduler intersects the declared local window with those absolute lifetime boundaries separately for each candidate date/timezone. A temporary rule can therefore expire part-way through a planning horizon or part-way through a local day without being applied to later candidate slots.

Scheduling remains minute-granular because candidate slots and persisted private placements are minute-granular.

## Precedence and conflicts

For each comparable candidate slot, applicable preferences are resolved through the Gate 7C order:

```text
currentInstruction
> explicitPersistent
> personallyTestedRule
> strongRepeatedAssociation
> weakAssociation
> populationInformedDefault
```

Only `explicitPersistent` is produced from the persisted Gate 7C store in this slice. The broader hierarchy remains available for later bounded learning work.

Lower-authority candidates cannot cancel or outvote higher-authority guidance merely through count. If the highest applicable authority contains both `prefer` and `avoid`, that slot receives no preference ranking advantage or penalty from the contradiction. The conflict is retained in placement provenance when that slot is selected; record ID or arrival order is not used as a hidden tie-break.

Hard feasibility, protected boundaries, timing constraints, Reduced Day rules and schedule safety remain outside and above this soft-preference ranking layer.

## Mutation ordering for future editing

The low-level Gate 7C repository remains available as persistence infrastructure. Production editing must use the Gate 7D1 mutation coordinator.

When an edit begins, the caller captures the exact current version of the target preference. At commit time the coordinator re-reads that same target inside the write transaction:

- if the same target has changed or been deleted, the command fails as stale;
- unrelated preference changes do not invalidate the command;
- independent edits to different preferences can still merge;
- a delayed same-timestamp save cannot resurrect a preference deleted after that save began.

This closes the remaining Gate 7C tied-command case without persisting deleted preference content or introducing a cross-device sync/version protocol.

## Preference change and accepted-plan integrity

When a confirmed preference mutation changes stored preference content and an accepted private plan exists, the same local transaction also records preference-repair attention.

The marker carries only the affected preference target(s), not deleted preference content. Multiple preference mutations before repair accumulate distinct targets.

The next normal private-plan ensure operation uses current canonical inputs and current preferences, releases only future scheduler-owned placements whose task/rhythm/area/task-type matches those affected targets, and runs the existing deterministic rolling repair. Unaffected targets retain normal schedule-inertia protection.

A successful preference repair clears the pending marker. If the preference mutation cannot atomically store repair attention, the preference mutation rolls back rather than leaving an accepted plan silently stale.

Undo of a preference-driven repair restores the prior plan but also restores preference-repair attention, because the explicit preference itself remains current. A later ensure can therefore reconcile the plan again rather than presenting the undone plan as preference-consistent truth.

## User-facing status

Gate 7D1 adds no production preference controls. That is deliberate: the integrity path is established before the editor can generate real concurrent mutations.

Gate 7D2 must provide calm inspect/create/edit/delete/export/clear controls and short grounded “why this time?” explanations. It must call the Gate 7D1 coordinator rather than the low-level repository directly and must surface stale-command, corrupt-store and repair-failure states truthfully.

No visual-redesign detour is required.
