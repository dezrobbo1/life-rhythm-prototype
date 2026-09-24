# Gate 7D2 — explicit preference editing, controls and reasons v0

## Outcome

Gate 7D2 completes the explicit-preference user loop established by Gates 7C and 7D1.

A user can now inspect, create, edit and individually delete local scheduling preferences, export the raw preference data, deliberately clear the preference data, and see short grounded reasons for automatic private placements. Preference mutations reconcile the accepted private plan through the Gate 7D1 repair boundary rather than requiring the user to understand scheduler internals.

This slice remains deterministic and local-first. It does not infer preferences, add confidence/decay learning, use an LLM, write external calendars, add cloud sync, or build the final learnt-about-me interface.

## Scheduling preferences surface

The production control is a collapsed **Scheduling preferences** section in Setup. Keeping it collapsed by default preserves the calm ordinary Setup surface and avoids opening local task/rhythm collections until the user chooses to manage preferences.

The editor exposes the existing Gate 7C record semantics:

- relation: Prefer or Avoid;
- target: Task, Rhythm, Area or Task type;
- weekday scope, where no selected weekday means every day;
- optional same-day local-clock start/end window;
- optional expiry.

The UI describes these values as soft scheduling guidance. Fixed commitments, protected time and other hard feasibility constraints remain authoritative.

Expired preferences remain visible and editable/deletable. Expiry stops a preference affecting new scheduling decisions; it does not silently delete history or become learned decay.

A `datetime-local` expiry is interpreted in the browser/device local timezone and persisted as an absolute ISO instant. This is a user-entered instant, distinct from the floating planner-local weekday/time window.

## Friendly target catalogue

The editor does not ask the user for internal IDs.

A separate read-only target catalogue loads:

- current task titles from Active/Today and Held records;
- non-archived rhythm titles;
- labelled Area enum values;
- labelled Task-type enum values.

Task IDs are the existing canonical intention IDs. Rhythm options use the scheduler's canonical `rhythm:<template-id>` identity, not raw Library template IDs. Pool-only intentions preserve task-type, priority and energy facts in the scheduling projection so a task-type preference works for Held tasks before they become active Today tasks.

Malformed task/rhythm rows are skipped with a partial-read warning; readable target options remain available. If those collections cannot be read, Area and Task-type preference controls remain available. Preference-store corruption is independent of this catalogue so the recovery/export controls remain reachable.

If an existing exact Task/Rhythm preference points to a target no longer available in the catalogue, the editor shows an unavailable saved target label rather than exposing the raw ID.

## Mutation and plan reconciliation

Production create/edit/delete operations use the Gate 7D1 target-scoped mutation coordinator.

The editor captures the exact target version when an edit begins. A stale same-target command fails visibly instead of overwriting or resurrecting newer state. Unrelated preference edits retain the Gate 7D1 merge semantics.

After a successful preference mutation, the UI immediately calls the current private-plan ensure/reconciliation path.

- If reconciliation succeeds, the plan surfaces are refreshed.
- If reconciliation fails, the preference remains saved and the durable Gate 7D1 preference-repair marker remains authoritative. The UI says the preference was saved but the flexible plan still needs updating.
- The application-level scheduler-state observer tracks `preferenceRepairPendingAt` alongside calendar repair attention. Plan surfaces can therefore show durable preference-repair attention across route/reload boundaries.

No external calendar event is created, moved or deleted by these actions.

## Individual deletion and clear-all

Individual delete uses the same target-scoped coordinator and therefore repairs only the affected future scheduler-owned region.

Clear-all requires the exact Gate 7C confirmation phrase:

`DELETE EXPLICIT PREFERENCES`

The Gate 7D2 clear coordinator runs preference reset and plan-repair attention in one local transaction.

For a healthy store, it records the exact distinct targets that were removed. For a malformed preference sidecar, deleted preference content cannot be trusted enough to recover exact targets, so recovery deletion conservatively marks every canonical Area target. That causes the next repair to reconsider future scheduler-owned work without inventing or retaining malformed preference content.

If repair attention cannot be stored while an accepted plan exists, the clear operation rolls back instead of leaving the old accepted plan silently presented as preference-independent.

Ordinary **Reset settings to defaults** does not delete scheduling preferences.

## Export and recovery

**Export scheduling preferences** wraps the raw Gate 7C sidecar in a small local JSON envelope containing format kind/version and export instant.

The export deliberately preserves malformed raw preference bytes. Export success means the data were read; it does not certify that those bytes are valid scheduling authority.

Missing and read-failure states remain distinct. A read failure never produces a manufactured empty backup.

Restore/import is not implemented in this gate.

## Why this time?

Automatic private placements in Plan expose an optional **Why this time?** disclosure.

The explanation is derived from the already-persisted deterministic placement provenance. It can surface:

- the selected task form/duration;
- usable planning space and protected/fixed-boundary respect;
- explicit preference guidance;
- preference conflicts that were deliberately not used as a tie-break;
- timing boundaries;
- Minimum Done fallback;
- rhythm preferred-day/time/frequency facts.

The presentation layer does not expose internal candidate IDs or persisted preference IDs. New preference-matching provenance also avoids writing preference IDs into its human-facing reason string. Older Gate 7D1 plan provenance remains readable through a compatibility presentation rule that strips the ID before display.

The explanation is factual scheduler provenance. It does not invent psychological motives or use AI.

## Data boundaries

Gate 7D2 does not delete or mutate unrelated:

- tasks or rhythms;
- external calendar data;
- behaviour history;
- ordinary settings/Life Shape;
- manual soft placements.

The existing local-data namespace boundary continues to apply.

## Validation and next step

The acceptance path is:

1. create an explicit preference from Setup using a friendly target;
2. commit it through the Gate 7D1 coordinator;
3. automatically reconcile the accepted private plan;
4. inspect a grounded placement reason;
5. edit/delete the preference and reconcile again;
6. export the preference data;
7. confirmed clear-all removes preference content and reconciles affected future automatic placements;
8. corrupt preference data can be exported then deliberately cleared without silently trusting it.

Gate 7D is complete after this slice.

The next bounded learning work is **Gate 7E — Explainable Personal Duration Learning v0**. It should start from trusted Gate 7B completion-duration samples and expose sample count/provenance. Gate 7B's time/context counts do not yet provide a matched opportunity denominator, so this contract does not authorize inferred time-of-day acceptance rates.
