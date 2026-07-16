# Persistence Readiness Audit

Status: Historical pre-implementation audit. Retained as the rationale for the first safe writes; it is not the current persistence inventory.

Current implementation status: settings, user-created Library rhythms, active Today tasks, Task Pool state, soft suggestions, user-confirmed placements, and selected backup/validation paths have progressed beyond this audit. Use `app/docs/life-rhythm-current-design-spec.md` and `app/docs/DOCUMENTATION_AUTHORITY.md` for the current boundary. References below to “read-only,” “first write,” or “next PR” are historical.

This audit checks whether the `/app` React prototype is ready for the first safe local write. It does not approve persistence for tasks, scheduling, legacy migration, or the root GitHub Pages app.

## Current Position

The app currently has a safe read-only bridge:

`local data shape / legacy inspection / fixtures -> read-only app snapshot -> pure selectors -> screen view models -> mock screens`

That boundary should stay intact for the next persistence step. The first write should be small, reversible, validated, and unrelated to task creation or scheduling.

## 1. What Data Exists Now?

- Zod schemas exist for settings, rhythm templates, active tasks, task history, completion logs, reset logs, Start Boost logs, dev tickets, migration logs, and app import/export payloads.
- Dexie table definitions exist for the same core data groups.
- Import/export validation can parse and serialize schema-backed app exports.
- Legacy `lifeRhythm_v146` inspection and migration planning exist, but only through injected read-only storage access and `willWrite: false` plans.
- The read-only adapter maps current-shaped data, legacy-shaped data, or fixtures into an `AppDataSnapshot`.
- The app snapshot provider exposes fixture/fallback/read-only adapter snapshots to screens.
- View model selectors build Today, Plan, Library, Reset, and Setup view models from snapshots.

## 2. What Data Is Mock-Only?

- Today Add one-off tasks are component state only.
- Task progression, pause/resume/minimum-done/keep-going state is component state only.
- Start Boost barrier/support/feedback flow is component state only.
- Library Create rhythm entries are component state only.
- Library enable/disable and Add to Today now confirmations are component state only.
- Reset actions and typed reset confirmation are component state only.
- Setup Life shape controls are component state only.
- Setup theme selection updates app-level React state, but is not saved.
- Setup Start Boost safety toggles are component state only.
- Dev tickets, backup/import/export buttons, and future modules are placeholders only.

## 3. What Should Be The First Safe Write?

Recommended first write: **Setup preferences**, not Library created rhythms.

The safest initial target is a single settings record covering theme, Start Boost safety preferences, and existing time anchors already represented in the settings schema. Setup is lower risk because it does not create tasks, does not alter the Library catalogue, does not imply scheduler behavior, and can be overwritten or reset without reconciling task identity.

Life-shape persistence should only include fields that are explicitly schema-backed. The current UI has life-shape fields that are not fully represented in the existing settings schema, including commute/travel time, fixed commitments, transition buffer, and low-capacity day preference. PR #27 should either:

- start with the existing schema-backed settings subset, or
- first extend the settings schema with a clearly named `lifeShape` object and tests before saving those controls.

Library created rhythms should be the second persistence candidate. They require stronger decisions about template IDs, duplicate handling, enabled state, export/import semantics, and future scheduler interpretation.

## 4. What Must Remain Read-Only?

- The root 1.4.6 GitHub Pages app and its files.
- The legacy `lifeRhythm_v146` localStorage key.
- Legacy migration planning and inspection.
- Read-only adapter mapping.
- View model selectors.
- Import validation paths, until an explicit backup/export write flow exists.
- Add one-off and Create rhythm flows, until their write semantics are separately approved.
- Any data that could imply scheduler behavior, task generation, or automatic Today placement.

## 5. What Root/Legacy Data Must Be Protected?

- Root `index.html`, `manifest.json`, `service-worker.js`, and root `README.md`.
- Browser localStorage keys used by the production/root app, especially `lifeRhythm_v146`.
- Older backup or migration keys from previous root versions.
- Any production GitHub Pages deployment behavior.

The `/app` persistence layer must use its own namespaced IndexedDB/Dexie database and must not read from or write to root localStorage during ordinary app startup.

## 6. What Migration Risks Exist?

- Legacy tasks may mix active Today tasks, library-like templates, starter defaults, and edited user tasks.
- Exact seeded/default task detection is fragile and should not be used until migration tests cover edited and duplicated cases.
- Library rhythms and one-off tasks must remain separate.
- Enabling a rhythm must not automatically create a Today task.
- Quick packs must not dump tasks into Today.
- Existing root data must not be mutated while the root app remains live.
- Current life-shape UI has fields that are not yet fully schema-backed.
- Import/export must stay ahead of writes so users have a recovery path.

## 7. What Export/Backup Step Is Needed Before Writes?

Before enabling writes, the app needs a validated export path for the data class being written.

For a first settings write, PR #27 should include:

- schema-validated settings export data,
- a way to confirm the exported payload can be parsed back through import validation,
- tests for invalid import rejection,
- a clear recovery path for deleting or replacing the `/app` settings record,
- no interaction with root localStorage or legacy keys.

Legacy backup export can remain read-only planning until migration execution is approved.

## 8. What Rollback Plan Is Needed?

For the first settings write:

- Use a namespaced `/app` Dexie database only.
- Keep the first write limited to one settings record.
- Validate before write and after read.
- Preserve defaults when settings are missing or invalid.
- Keep the provider able to fall back to fixtures/defaults.
- Add a dev-only/manual reset note for deleting only the `/app` database, not root app storage.
- Do not run migrations or modify legacy data.

If a settings write fails, the app should show safe defaults and continue without blocking the mock UI.

## 9. What Tests Must Exist Before Writes?

Before PR #27 writes anything, tests should cover:

- settings schema validation for valid and invalid payloads,
- Dexie settings repository write/read/update behavior in an isolated test database,
- provider fallback when stored settings are missing or invalid,
- no localStorage calls in the `/app` provider path,
- no writes in read-only adapter or migration planning paths,
- export validation for the written settings shape,
- Setup controls update only the intended settings fields,
- theme remains color-only,
- Add one-off remains in-memory only,
- Create rhythm remains in-memory only,
- Library rhythms do not become Today tasks,
- root protected files remain untouched by the PR.

## 10. What Should PR #27 Do If This Audit Passes?

PR #27 should implement **settings persistence only**.

Recommended scope:

- Add a small settings repository over Dexie for the `/app` database.
- Persist theme and Start Boost safety preferences.
- Either persist only existing schema-backed work/meal/sleep anchors, or extend the settings schema first with a `lifeShape` object for commute/travel time, fixed commitments, transition buffer, and low-capacity day preference.
- Read settings into the app snapshot provider through a clearly separated persistence path.
- Keep view model selectors pure.
- Keep Add one-off, Create rhythm, scheduler, migration, import execution, reset execution, and dev tickets mock-only.
- Add export/validation tests for the persisted settings shape.

Do not persist Library created rhythms in PR #27. That should come after settings persistence proves the local write, export, fallback, and rollback paths are stable.
