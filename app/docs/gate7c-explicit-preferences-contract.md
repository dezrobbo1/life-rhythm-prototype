# Gate 7C — explicit preferences and precedence v0

## Implemented boundary

Gate 7C adds local user-declared preference storage, validated edit/delete/export operations, and a pure precedence selector. It does not infer preferences from Gate 7A events or Gate 7B statistics. It does not load preferences into the live coordinator, alter scheduler ranking, introduce AI/ML, or build the final learnt-about-me interface.

No production UI writes these preferences yet. This is the explicit-preference foundation, not completion of Gate 7 or an end-to-end personalised scheduling workflow.

## Record and storage

Each preference contains an exact stable ID, target kind/value (intention, rhythm, area, taskType), prefer/avoid relation, weekday scope, optional paired same-day HH:MM start/end, optional expiry instant, created/updated instants, and fixed explicitPersistent/user/explicitPreference provenance. Area and task-type values must match existing canonical enums. Empty weekday scope means all days; an omitted time pair means the whole applicable day. Times are floating planner-local wall-clock values, not UTC instants. Overnight windows are explicitly unsupported in v0.

The strict version-1 sidecar lives at `preferences:explicit:v1` in the existing settings store. It is not added to the `settings` or `dayProfileFoundation` records. Database version remains 5; stores, indexes, legacy settings schemas and settings-backup formats are unchanged.

The repository uses an ID-scoped typed view of that shared store and validates raw reads as unknown. It does not cast a preference record to Settings. Schema checks reject duplicate IDs/weekdays, unknown fields, spoofed provenance, unsupported format versions, invalid dates/times, and inconsistent timestamp ordering. Expired records remain inspectable; expiry does not delete data or represent learned decay.

Every read-modify-write or read-modify-delete runs in one Dexie read-write transaction. Concurrent independent edits cannot overwrite each other's records, including across database connections. A failed or aborted write returns failure and preserves prior committed data. Editing preserves original creation time. Backdated writes are rejected rather than silently moving metadata backwards. The final individual deletion writes an empty sidecar as a durable deletion boundary rather than removing the record.

Readers distinguish missing, ok, invalid and readFailed. Missing means no sidecar record is present in this namespace; `ok` with an empty preference array means no preference content remains but deletion ordering is retained; corruption or read failure never becomes empty/default authority. Ordinary editing and individual deletion refuse an invalid sidecar. Reads and projections never write or regenerate state. Each operation captures its local namespace once.

### Deletion ordering

Final-item deletion and confirmed reset retain only the existing version-1 record metadata and `preferences: []`. No deleted preference IDs, target values, scope, provenance or malformed payload fields remain. `updatedAt` retains the deletion/reset command instant in the same atomic transaction; no new schema, store or database version is needed.

A save older than the stored `updatedAt` is rejected. When the record is empty, an equal instant is also rejected: timestamp ties cannot silently undo deletion. A genuinely new save with a later instant can recreate a preference, with a new preference creation time. The marker survives database reconnection, reads, export and unrelated settings reset. An individual delete of a missing ID remains a no-op.

Confirmed reset establishes a boundary even on a missing/empty store and reports `removed: false` when there was no content to delete. A reset older than a valid record is rejected. Deliberate recovery of malformed data uses the reset command instant and fresh record metadata, not untrusted timestamps from that payload. Aborted marker writes preserve the previous committed state, including corrupt data or the absence of a record.

This ordering uses the command timestamp captured before queueing; callers must retain it across retries rather than restamping an old save as a new command. It is not a cross-device logical-version or sync protocol.

## Precedence

The implemented order is:

```text
currentInstruction
> explicitPersistent
> personallyTestedRule
> strongRepeatedAssociation
> weakAssociation
> populationInformedDefault
```

Only explicitPersistent is persisted. The other classes describe the precedence contract and appear in synthetic tests, not a new learning implementation. Current instructions remain runtime-only candidates, not permanent preferences. Hard commitments, feasibility and protected boundaries remain outside and above this soft-preference selector.

`resolvePreferencePrecedence(candidates, scopeKey)` selects for one comparable decision. The caller must first establish target, time-window and contextual applicability and assign that decision's scope key; the selector is not a target matcher or interval-overlap detector. Unrelated scope keys cannot suppress or conflict with one another. Within one scope, all candidates at the highest available level are returned. Opposing relations at that level produce conflict; lower-ranked evidence, IDs and arrival order cannot silently resolve it. Unknown sources and duplicate candidate IDs within the decision are rejected. Ordering is locale-independent and input data are not mutated.

## Scheduler seam and expiry

`activeExplicitPreferences` and `explicitPreferencesForScheduler` accept strictly validated records and an explicit ISO decision instant. Records whose current version is not yet effective (`updatedAt`), or whose expiry is at/before that instant, are excluded. Invalid evaluation timestamps throw instead of masquerading as an empty preference set. This projects the current stored version, not a historical reconstruction.

The scheduler projection matches the existing SchedulingPreference type and retains declared provenance. It is for one decision instant only: it drops expiry metadata and must not be loaded once for an entire multi-day horizon. A future integration must evaluate applicability/expiry for each scheduling decision and preserve live feasibility, protection, repair and Undo semantics. No coordinator imports or consumes this seam in Gate 7C.

## Export, recovery and privacy

`exportExplicitPreferencesResult` returns the raw sidecar, including malformed data, without writes. After deletion, export includes the empty ordering record, not a missing result or deleted preference content. Raw export success means data were read, not that those data are validated scheduling authority. Failed export does not manufacture an empty backup. No download, network request or restore is performed by this foundation.

`resetExplicitPreferences` requires the exact confirmation `DELETE EXPLICIT PREFERENCES`. It can clear a malformed sidecar for deliberate recovery, retaining only the empty ordering record described above, and touches only that exact record. Ordinary item deletion remains fail-closed. Tasks, placements, plans, calendar records, the behaviour ledger, settings and day-profile state are untouched.

These are repository-level controls only. Before exposing preference editing or live scheduling use, the next bounded slice must provide usable inspect/correct/export/delete controls and truthful failure presentation. Existing UI backup/reset controls do not claim to include this new inactive data class.

## Verification and next step

Focused tests cover valid/invalid schemas, provenance, timestamp consistency, strict read states, concurrent edits, queued stale saves after final deletion/reset across database connections, reopen persistence, timestamp ties, fresh recreation, empty-store reset, backdated reset rejection, transaction rollback, namespace isolation, recovery deletion/export, expiry boundaries in UTC and Australia/Perth, all precedence-level pairs, scoped conflicts, and deterministic ordering. Tests use synthetic records only.

Next bounded product work: an explicit-preference editing and scheduling integration workflow with visible reasons and easy correction. After that, add one bounded explainable learning capability. No visual-redesign detour is required. Gate 7A stays the observed-fact ledger; Gate 7B stays descriptive statistics; inferred preferences, confidence/decay, and the final learning view remain deferred.
