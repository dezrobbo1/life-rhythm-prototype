# Gate 8A2 — Rhythm End-to-End

Status: Complete on the reviewed Gate 8A2 PR head

Reviewed `main`: `5436c64137d543b76a347dd8920f1de6e4d1dcae`  
Review date: 2026-09-25  
Predecessor: PR #157, Gate 8A1, merged

Gate 8B remains **not started**. Gate 8A3 — Availability + Calendar is the next bounded milestone.

## Verified starting baseline

On the reviewed base, built-in rhythm rows were code-backed suggestions whose `enabled` values and UI toggles were session state. Custom templates persisted but were forced off, while their create form described enablement as preview-only. Both Create Rhythm and Add to Today manufactured 5/10/20-minute variants. `RhythmTemplate` and the scheduler already represented variants, frequency, period, preferred days/time, max per day, Reduced Day substitution and template-level rhythm requirements, but no durable plan, recurrence revision, instance generator or occurrence lifecycle existed. Scheduler rhythm placements therefore had no concrete executable Today owner, and task history had no rhythm-instance identity.

The older recurrence contract's suggestion-only and separately approved `placeSoftly` restrictions predated the automatic private scheduler delivered by Gates 3–7. Current `PRODUCT.md`, `MVP_PLAN.md` and `ARCHITECTURE.md` authorise deterministic, local, reversible private-plan placements. Gate 8A2 integrates instances with that authority; it does not write to an external calendar.

## Implemented authority

| Class | Canonical responsibility |
| --- | --- |
| `RhythmTemplate` | Stable built-in or custom content identity, classification, purpose and exact authored Minimum/Normal/Full actions and minutes. Its legacy `enabled` field is retained only for compatibility and is forced false on confirmed writes. |
| `RhythmPlan` | One stable personal recurrence owner per template, with enabled/paused/disabled state, preferred time, timezone, initial effective date, latest revision, no-catch-up policy and automatic-private planning mode. |
| `RhythmRecurrenceRevision` | Monotonic, prospective, plan-linked flexible-quota snapshots. A template-only edit reuses the revision; a recurrence change creates a new revision with an explicit effective local date. |
| `RhythmInstance` | One deterministic quota-slot occurrence with template/plan/revision links, exact variant and recurrence snapshots, eligibility window, lifecycle/completion/planning state and optional Today/placement links. |
| `ActiveTask` projection | Today/Now interaction state with an explicit `sourceRhythmInstanceId`; the linked instance remains the occurrence owner. |

The database advances from v5 to v6 with separate `rhythmPlans`, `rhythmRecurrenceRevisions` and `rhythmInstances` stores. Existing rows are preserved. Migration does not promote catalogue/session `enabled`, custom-template hints, old frequency fields or existing Library-created Today tasks. A pre-v6 accepted template-level rhythm placement is retained as derived evidence but marked for repair instead of being silently reused as canonical v6 authority.

## Recurrence subset and decisions

Gate 8A2 implements flexible quota only: a positive whole-number frequency per day, week or month; optional preferred weekdays; broad preferred time; positive max per day; IANA timezone; and explicit effective-from local date.

- Day identity is the local calendar date.
- Week identity is the Monday-start local week.
- Month identity is the local calendar month.
- The existing private-plan horizon is seven local dates. Generation opens each recurrence period intersecting that horizon; generated instances retain the remaining local-period eligibility window.
- Generation starts no earlier than the initial or governing revision effective date and the first observed horizon date. A partial first period is capped by remaining days multiplied by max per day, so it never backfills or emits infeasible quota.
- Period slot numbers provide identity, not rank, pressure or debt. Missed or skipped quota never carries into the next period.
- Repeated generation, reload and retry reuse stable plan/period/slot keys. Closed instances remain deduplication evidence.
- Prospective recurrence edits preserve every already generated instance and its snapshot. Only ungenerated capacity after the revision's effective date uses the new revision.
- Pause and disable both stop new generation. Pause communicates a temporary stop; disable turns the plan off until explicitly enabled. Neither deletes the plan, template, instances, started work or history. Re-enable reuses the same plan.
- Destructive plan deletion is unavailable.

Deferred extensions are every N days, every N weeks, fortnightly/anchored cadence, hard fixed weekdays, anchored day of month, every N months, travel/timezone rebuilding, calendar-style recurrence and external calendar writes. Preferred weekdays guide scoring; they are not compliance rules or debt.

## Scheduler and daily execution

The live projection creates one scheduler requirement per eligible, non-closed instance. Accepted rhythm placements retain exact template, plan, revision and instance IDs; two quota slots cannot collapse to one target or acquire duplicate automatic placements. Current hard/protected constraints, explicit preferences, schedule inertia, rolling repair and Reduced Day behavior remain in place. Reduced Day may choose the occurrence's snapshotted Minimum version without changing the plan, recurrence, future quota or template.

Turning on, pausing, disabling, editing recurrence, editing template durations, generating instances, routing an instance to Today, and closing an instance all reconcile the accepted private plan or atomically leave repair attention. Malformed derived plan state cannot block correction of canonical rhythm data. Canonical stale-write snapshots now cover templates, plans, revisions and instances.

An accepted current-date rhythm placement is atomically projected into Today with its exact planned variant. Existing task controls provide Start, Pause, Resume, Minimum Done, completion/stop and calm skip/decline. Every generated-occurrence mutation updates both the Today projection and its canonical instance in one transaction. It never creates a Task Pool row. Completion closes only the occurrence and leaves the template and recurring plan intact.

Factual lifecycle events carry task/Today projection ID, template ID and exact rhythm-instance ID, plus actual active duration where the trusted timer provides it. They add no motivation, adherence, success or psychological interpretation. Because Gate 8A6 has not yet distinguished Normal Done, Full Done and Stop, generated-instance completions are deliberately excluded from Gate 7E duration adaptation while remaining available as factual history.

## Truthful authoring and Library boundary

The Library form requires a title, category, Minimum action and positive whole minutes, plus a valid flexible quota. Optional Normal inherits the exact Minimum action and minutes; optional Full inherits the exact resulting Normal action and minutes. No path derives duration from `recommendedSize` or creates 5/10/20-minute variants. Saved values remain inspectable and editable.

A built-in is catalogue content until the person confirms configuration. Confirmation persists the original stable built-in ID; subsequent catalogue presentation changes do not overwrite the saved variants or recurrence. Custom rhythms use the same durable path and retain stable IDs. Session-only enable controls are gone. Quick Packs are preview-only until later pack ownership semantics are approved.

`Add to Today once` requires a confirmed template. If a live generated occurrence for that template is eligible today, it surfaces/reuses that exact occurrence. Otherwise it creates one deterministic manual template/date Today task. Repeating the action reuses the logical Today object. The manual action neither fabricates a plan nor changes enablement or consumes recurrence quota.

## Backup and remaining limits

The versioned rhythm-authority v1 export/check format covers configured templates, plans, revisions, instances, linked Today projections and instance-linked factual events. It rejects malformed or duplicate identity and inconsistent included references. If companion classes are absent, the checker reports dependencies as `unverified` rather than claiming complete restoration. Restore execution remains deliberately unavailable.

This milestone does not solve usable-day/calendar authority, provider recurrence, cloud durability, general mutation convergence, individual Move/Protect, completion-variant evidence, application-wide UI convergence or trial instrumentation. Those remain Gates 8A3–8A8. Owner-only Perth testing may exercise this rhythm path on one browser as prototype feedback, but it is not Gate 8B longitudinal evidence.

## Exit disposition

Gate 8A2 passes when the exact PR head has passed the permanent unit/integration suites in UTC and Australia/Perth, recurrence/DST-focused checks in Australia/Sydney, production build, diff hygiene, supported browser acceptance and one substantive review. The PR record is the authority for the exact commands, manual coverage and final head SHA.
