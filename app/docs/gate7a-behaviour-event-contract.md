# Gate 7A — observed behaviour event contract

## Boundary

Gate 7A records facts that the application directly observed. It does not infer preferences, motivation, psychological state, productivity, or the reason a person acted. It does not score behaviour or change scheduler ranking.

The canonical v0 ledger reuses the existing IndexedDB `taskHistory` table. New rows are strict, versioned `behaviourEvent` records; the older task-history row shape remains readable for backup compatibility but is not accepted as a learning fact. The existing `completionLog` and `startBoostLog` tables remain legacy/schema-only infrastructure because the application does not currently write them at runtime. Current scheduler repair metadata remains the accepted-plan audit snapshot, while selected factual placement changes are copied into the append-only ledger.

## Canonical fields

Every trusted event has a stable ID, schema version, event type, ISO `occurredAt`, local date, IANA timezone, observed source, action, and provenance. Task, template, rhythm, or placement IDs are present when applicable. Strict before/after snapshots contain only factual lifecycle or placement values. A completion includes observed active minutes only when start/resume facts make that duration available.

`source` distinguishes user and scheduler activity. `provenance.origin` distinguishes a user action, initial scheduler build, automatic repair, or Undo, and `provenance.mechanism` names the write path. Initial-plan placement facts use `initialPlanBuild` / `schedulerInitialBuild`, not repair provenance. A scheduler movement remains scheduler-originated even when a user action caused the repair; the event does not claim that the user chose that movement.

## Event types

| Area | Events | Runtime boundary |
| --- | --- | --- |
| Capture and Today | `taskCaptured`, `taskCreated`, `taskAddedToToday` | Held capture, one-off Today creation, and Library/Held addition to Today |
| Task lifecycle | `taskStarted`, `taskPaused`, `taskResumed`, `taskContinued`, `taskMinimumAchieved`, `taskCompleted`, `taskParked`, `taskNotToday`, `taskNoLongerNeeded` | Material persisted lifecycle transitions |
| Holding | `taskDeferred` | A factual Hold-until change |
| User placement | `userPlacementCreated`, `userPlacementMoved`, `userPlacementRemoved` | User-confirmed placement changes; v0 currently emits create/remove because no coordinate-move action exists |
| Automatic placement | `schedulerPlacementAdded`, `schedulerPlacementMoved`, `schedulerPlacementRemoved`, `schedulerPlacementVariantChanged` | Scheduler-owned placements accepted by the initial plan build or a later repair, with distinct build/repair provenance |
| Override | `schedulerRepairUndone` | A successful one-step scheduler repair Undo |

“Stop”, “Normal Done”, and “Full Done” currently share the persisted `done` transition, so Gate 7A records the supported fact `taskCompleted` and does not invent an unavailable completion-mode explanation. Opening Start Boost does not currently persist a choice, so it does not create a behavioural event.

## Atomicity and idempotency

- Production capture, Today creation/addition, lifecycle, deferral, and user-placement facts are required writes in the same Dexie transaction as their primary state change. If the fact cannot be stored, the primary change rolls back.
- Initial scheduler-owned placement facts, repair facts, and Undo facts commit in the existing conditional scheduler-plan transaction. A stale or failed plan write commits neither the plan nor its events.
- Repeating an already-material lifecycle state, reloading, rendering, or reading the ledger does not append an event. An identical event ID and payload is an idempotent no-op; the same ID with different content is rejected and never overwrites history. Scheduler event IDs are deterministic within an accepted build/repair, and the conditional scheduler-state boundary prevents a stale retry from appending facts.
- Malformed rows and legacy task-history rows are excluded by the dedicated strict reader and reported as a partial read. They never become trusted learning input.
- Writing or reading a behaviour event has no scheduler authority and cannot write an external calendar.

## Privacy and local-first behaviour

Events stay in the existing local IndexedDB namespace. Reset now has a dedicated control that exports every Gate 7A-tagged `behaviourEvent` row as local JSON and a separately protected control that deletes only those rows after the person types `DELETE BEHAVIOUR HISTORY`. This includes an unreadable tagged row so corruption cannot make personal data invisible or undeletable, while only schema-valid rows can become trusted facts. Legacy task-history rows share the table but are excluded from both the Gate 7A export and deletion; tasks, plans, settings, placements, calendars, and other logs are untouched. Gate 7A adds no network transport, cloud profile, telemetry, or external-calendar write. The ledger stores compact structured facts and identifiers rather than free-text behavioural interpretations.

## Relationship to Gate 7B

Gate 7B computes transparent descriptive statistics from validated events under `app/docs/gate7b-descriptive-statistics-contract.md`. Preference learning, scoring, confidence, user-facing learning explanations, scheduler adaptation, and any predictive or psychological inference remain outside Gate 7A.
