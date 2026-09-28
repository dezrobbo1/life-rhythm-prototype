# Gate 8A4 — portable canonical profile v1

Base: `697860427cab5008c3c13ef50b4c7201f560932a` (PR #162 merged). This contract describes user-controlled local backup and replace recovery. A Clerk sign-in selects a local namespace; it does not upload the backup or synchronize devices.

## Persisted class inventory

| Dexie store or sidecar | Class | Portable? | Schema / relationship | Restore policy |
| --- | --- | --- | --- | --- |
| `settings`: `settings` plus `dayProfileFoundation` | Canonical personal state | Yes, as combined `settings` | `settingsSchema`, existing day-profile migration/relationship rules | Split into rollback-readable settings row and foundation row; replace both |
| `settings`: `preferences:explicit:v1` | Canonical personal state | Yes | `explicitPreferenceStoreRecordSchema`; user provenance retained; symbolic target IDs may refer to completed/archived intentions, so no new existence constraint | Replace sidecar or delete when absent |
| `settings`: `learning:duration-controls:v1` | Canonical personal state | Yes | `durationLearningControlStoreRecordSchema`; authored template IDs can outlive live templates | Replace sidecar or delete when absent; no re-inference |
| `rhythmTemplates` | Canonical personal state | Yes | `rhythmTemplateSchema`, unique IDs | Replace |
| `rhythmPlans` | Canonical personal state | Yes | `rhythmPlanSchema`, template and latest revision | Replace |
| `rhythmRecurrenceRevisions` | Canonical personal state | Yes | `rhythmRecurrenceRevisionSchema`, plan and contiguous revision identity | Replace |
| `rhythmInstances` | Canonical personal state | Yes | `rhythmInstanceSchema`, plan/template/revision, stable occurrence identity and linked Today projection | Replace |
| `activeTasks` | Canonical personal state | Yes | `activeTaskSchema`; persisted Today sources are `adhoc` or `library` (`custom` is not readable by the normal repository); generated rhythm occurrence link when present; historical Library template IDs can outlive live templates | Replace |
| `taskPoolItems` | Canonical personal state | Yes | `taskPoolItemSchema`; historical template/instance hints may outlive their objects | Replace |
| `softPlacements` | Canonical personal state | Yes | `softPlacementSchema`; live placements reference a Today task or Held item; visible placements cannot collide on date/task or date/block; removed records may retain historical task IDs | Replace |
| `taskHistory` rows with `recordKind: behaviourEvent` | Canonical factual history | Yes | `behaviourEventSchema`, unique IDs; historical task/template/instance references can outlive current authority | Replace without reinterpretation |
| `calendarSources` | External source snapshot / canonical scheduling input | Yes | `calendarSourceRecordSchema`, `IcsCalendarAdapter.readForImport` and scheduling's fragment preflight | Replace or delete when absent; preserve source and buffers |
| `schedulerPlanState` | Derived/rebuildable private plan | No | Scheduler plan state schema | Clear on restore; rebuild from restored authority |
| `taskHistory` legacy rows, `completionLog`, `startBoostLog` | Legacy compatibility history | No | Historical schemas | Not promoted as current Gate 7 factual events. Legacy `taskHistory` rows are cleared with the shared history table on replace; other legacy-only tables are untouched and excluded. Separate historical exports remain available where applicable. |
| `resetLog` | Operational history | No | Historical reset schema | Preserved locally, not portable |
| `devTickets` | Diagnostic | No | Dev-ticket schema | Preserved locally, not portable |
| `migrationLog` | Migration bookkeeping | No | Migration schema | Preserved locally, not portable |

Unknown settings sidecars fail export. A history row that matches neither the trusted Gate 7 behaviour schema nor the legacy history schema fails export; it is never silently reclassified as trusted data. The separate raw behaviour export can preserve such bytes for investigation, but it is not a trusted portable restore. No auth secret, Clerk identifier, device database name, service worker cache, protected legacy root localStorage, or mock data belongs in v1.

## Format and authority

`format: "life-rhythm-portable-profile-backup"`, `formatVersion: 1`, informational `appVersion`, `exportedAt`, and one strict `data` object with every included class. Each class is required; singleton records are nullable. Missing singleton means delete any destination singleton. Future versions, unknown top-level keys and unknown data classes fail. Export and check read only the active namespace. The file belongs to the user; moving it to another browser does not bind it to the former namespace. Existing class-specific check-only artifacts do not acquire restore authority.

The checker validates all rows, duplicate IDs, runtime rhythm/instance relationships, and the static calendar safety boundary before displaying counts. It creates no local data. Import validation uses the adapter's current bounded whole-source BUSY fragment preflight and scheduling's same-window defensive preflight. No calendar provider connection is made. Calendar buffers remain included in the saved source record.

Conflict policy: **replace current local profile**, never merge or choose by timestamp. A non-empty current canonical destination requires typing `REPLACE LOCAL PROFILE`. Preview records a deterministic snapshot of every affected canonical table and scheduler plan row; restore compares the same snapshot inside one write transaction before any mutation. A changed destination must be checked again. Atomic replacement clears affected canonical tables and the derived scheduler plan, then writes the checked backup. A thrown write aborts the whole Dexie transaction. The UI reloads after success to discard pre-restore in-memory state.

Open-ended recurrence safety remains a bounded rolling-horizon guarantee; infinite future occurrences are not enumerated. Restore validates current import horizon under the destination browser's timezone. Legacy or corrupt destination canonical rows are not silently overwritten; repair/export separately first. Live synchronization and cloud backup are outside Gate 8A4.
