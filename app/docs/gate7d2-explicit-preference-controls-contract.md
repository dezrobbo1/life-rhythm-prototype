# Gate 7D2 — explicit preference editing + reasons/controls v0

## Boundary

Gate 7D2 completes the explicit-preference user loop on top of Gate 7D1. A user can inspect, create, edit, remove, export and clear explicit scheduling preferences without handling internal IDs, and the accepted private plan is reconciled automatically after a confirmed change.

This slice does not add inferred preferences, behavioural confidence/decay, AI/ML, natural-language preference capture, cloud sync, external-calendar writes or the final learnt-about-me interface.

## Scheduling preference UI

Setup contains a dedicated **Scheduling preferences** section. The editor supports:

- Prefer or Avoid;
- Task, Rhythm, Area or Task type targets;
- named task/rhythm selectors rather than raw IDs;
- every-day or selected-weekday scope;
- optional paired local start/end times;
- optional expiry;
- inspect/edit/remove for existing records, including expired records.

The persisted ID remains internal and is not shown as ordinary UI copy.

Area and task-type choices come from the existing canonical enums. Task choices are derived from current Today/Held records and rhythm choices from enabled, non-archived rhythm templates. Reading the target catalogue is independent of the explicit-preference sidecar, so corrupt preference bytes do not prevent recovery controls from rendering.

## Mutation and plan repair

Production create/edit/delete actions use the Gate 7D1 target-version mutation coordinator, not direct low-level preference writes.

After a successful mutation, the UI immediately calls the normal private-plan ensure path:

```text
validate/edit intent
→ atomic preference mutation + durable repair attention
→ ensure current private plan
→ bounded deterministic repair
→ refresh Today/Plan presentation
```

If the preference write succeeds but immediate repair cannot complete, the preference remains saved and Gate 7D1's durable repair marker remains authoritative. The UI reports that the flexible plan still needs updating rather than describing the old plan as current.

The application scheduler-state observer now treats preference-repair marker changes as presentation-invalidating events, so already-mounted daily/plan surfaces reread current state after another tab changes preference repair attention. The observer itself remains read-only.

## Export and clear-all

Export wraps Gate 7C's raw recovery/export read in a local JSON file. It can therefore export a malformed sidecar for recovery inspection without treating malformed bytes as scheduling authority. Missing preference state exports as an explicit null record rather than fabricating a valid preference store.

Clear-all requires the exact confirmation phrase:

```text
DELETE EXPLICIT PREFERENCES
```

The Gate 7D2 clear coordinator performs preference reset and accepted-plan repair attention atomically. For a valid record it retains the declared affected targets before deleting content. For malformed preference bytes, where declared targets cannot be trusted, it conservatively records exact targets of current scheduler-owned placements before recovery deletion. If repair attention cannot be persisted for an existing affected plan, the clear operation rolls back.

Clear-all does not delete tasks, rhythms, calendars, behaviour history, ordinary settings or user-confirmed placements.

## Why this time?

Automatic private placements expose an optional **Why this time?** disclosure derived from persisted scheduler provenance.

The presentation layer translates scheduler facts into short grounded statements such as:

- Life Rhythm placed this flexible item automatically.
- The normal version fits here.
- This sits inside usable time while hard/protected boundaries stay clear.
- A saved scheduling preference matched this time.
- Saved preferences conflict here, so neither side was used to choose the time.

Internal candidate IDs and preference IDs are not displayed in these explanations. No LLM is involved.

## Failure and recovery

Malformed or unreadable preference state is not presented as an empty healthy list. Ordinary create/edit/delete controls are disabled while recovery state is unhealthy, but export and confirmed clear remain reachable.

Stale target-version edits fail visibly and require a reread rather than silently overwriting another edit.

## Verification and next step

Focused tests cover plan-aware clear, corrupt-store recovery targeting, confirmation protection, editor wiring through the Gate 7D1 mutation coordinator, automatic plan reconciliation, recovery-control availability and provenance redaction.

The next bounded Gate 7 slice is **Gate 7E — Explainable Personal Duration Learning v0**. Duration learning should use trusted Gate 7B completion-duration observations with transparent sample counts and bounded confidence. Time-of-day preference inference remains deferred until the event model has a defensible opportunity denominator.
