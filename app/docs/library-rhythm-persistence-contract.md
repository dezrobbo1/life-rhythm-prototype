# Library Rhythm Persistence Contract

This contract prepares the next possible local write after settings. It does not approve or implement that write.

Library rhythms are reusable planning templates. They must stay separate from Today one-offs, active tasks, scheduler output, task progression, and completion history. The current Create rhythm, Enable rhythm, Disable rhythm, Quick pack, and Add to Today actions remain in-memory preview behavior until a later PR explicitly connects persistence.

## 1. Approved Future Write Target

The only approved future write target from this contract is **user-created Library rhythms**.

That future write may persist reusable rhythm templates created by the user in the Library. It must not persist:

- Today tasks,
- Add one-off tasks,
- Add to Today state,
- task progression,
- completion state,
- scheduler output,
- quick pack execution,
- migration results,
- import/restore execution.

Built-in/mock rhythms may continue to ship with the app as code or fixtures, but the future write must not silently copy every built-in rhythm into persisted storage.

## 2. Fields That May Be Persisted Later

The future Library rhythm write may persist fields that are already represented by the rhythm template contract and needed to recreate a reusable rhythm:

- `id`
- `source`, limited to user-created/custom rhythms for the first write
- `title`
- `area` / category
- `taskType`
- `kind`
- `completionStyle`
- `priority`
- `energy`
- `startBarrier`
- `purpose`
- `minimum`
- `normal`
- `full`
- `fallback`
- `schedule` hints that are already schema-backed:
  - `bestTime`
  - `fixedTime`
  - `targetDate`
  - `lateHandling`
  - `bufferMode`
  - `prepMinutes`
  - `travelMinutes`
  - `cleanupMinutes`
  - `transitionMinutes`
  - `frequency`
  - `period`
  - `preferredDays`
  - `maxPerDay`
  - `movable`
  - `droppable`
  - `catchupAllowed`
- display chips, if the future schema explicitly adds or maps them for Library display
- `createdAt`
- `updatedAt`
- `archivedAt`, only for a future soft-delete/archive flow

`enabled` may be persisted only if the future write PR explicitly approves Library enablement persistence. Until then, enable/disable remains in-memory only.

## 3. Fields Not Persisted Yet

These fields and behaviors are not approved for Library rhythm persistence:

- Add to Today state
- active Today tasks
- one-off tasks
- task progression
- pause/resume/minimum-done state
- completion history
- Start Boost logs
- scheduler output or capacity decisions
- reset logs
- import execution
- migration logs
- dev tickets
- future modules
- root GitHub Pages app data
- legacy localStorage data such as `lifeRhythm_v146`

Settings backup remains settings-only. Library rhythm backup/export needs its own schema and validation before rhythm writes are enabled.

## 4. Identity Rules

Generated rhythm IDs must be stable after creation. Editing a user-created rhythm must keep the same ID unless a later migration/import rule explicitly regenerates it.

Imported or restored IDs must be validated by a future import validation PR before any restore writes occur. A duplicate title does not mean two rhythms are the same rhythm. Title matching must not be used as identity.

Duplicate IDs must be handled deliberately:

- no silent overwrite,
- no silent merge,
- no replacement of built-in/mock rhythms,
- no replacement of an existing user-created rhythm without an explicit rule.

A future write PR must choose one duplicate-ID behavior before persistence is connected: reject the new rhythm, regenerate a safe ID, or surface a user-visible choice. Until that rule exists, duplicate-ID restore/import writes are not approved.

## 5. Duplicate Handling Expectations

The first Library rhythm persistence PR must not silently overwrite existing data. If a user creates a rhythm with the same title as another rhythm, it should remain a separate rhythm with its own ID.

User-created rhythms must not replace built-in rhythms or mock catalogue entries. Built-in rhythm identity and custom rhythm identity must remain separate.

Future import must handle duplicate IDs safely before restore execution is connected. Import preview may report duplicate IDs, but it must not repair them by writing data in the validation step.

## 6. Enablement Semantics

Enablement means a reusable rhythm is available for future planning logic when that logic is approved. Enablement does not mean:

- create a Today task,
- add work to the current day,
- generate scheduler output,
- create a catch-up pile,
- copy a rhythm into active tasks.

Disabling a rhythm must not delete the rhythm, its future history, or any active task that was separately created from it. Enablement persistence remains separate from rhythm-template persistence unless the future write PR explicitly includes it.

Quick packs must continue to enable groups of rhythms only in the UI layer until persistence is approved. They must not dump tasks into Today.

## 7. Add to Today Boundary

Add to Today is not persistence. It is a user-triggered Today action and must remain separate from saving a reusable Library rhythm.

The future Library rhythm write must not:

- automatically create Today tasks,
- silently inject rhythms into Today,
- schedule a rhythm,
- write active task rows,
- write completion rows,
- write scheduler output.

If Add to Today persistence is ever approved, it must be handled by a separate active-task contract and write PR.

## 8. Export And Backup Requirement

Library rhythm writes should wait until a Library rhythm backup/export path exists. That path must be schema-validated and must round-trip through import validation before restore execution is considered.

Requirements for the future Library export:

- export user-created Library rhythms only unless built-in export is explicitly approved,
- do not include settings unless a combined backup format is separately approved,
- do not include active tasks or Today one-offs,
- do not include scheduler output,
- do not include reset logs, dev tickets, migration logs, or future modules,
- do not include root GitHub Pages localStorage data,
- do not include legacy `lifeRhythm_v146` data,
- keep the existing settings backup settings-only.

Export must remain user-triggered. It must not run automatically as part of rhythm creation.

Backup validation scaffolding may exist before persistence as long as it is pure, receives explicitly supplied rhythm template data, and does not read or write Dexie, IndexedDB, localStorage, migrations, imports, resets, active tasks, or scheduler output.

## 9. Rollback Expectations

Settings reset remains settings-only and must not delete rhythms.

No whole-app reset is approved by this contract. A future rhythm reset/delete/archive must affect rhythm data only and must not touch:

- settings,
- Today tasks,
- one-offs,
- scheduler output,
- import/migration logs,
- root app data,
- legacy localStorage.

Rollback for the first rhythm write should include a safe way to ignore invalid stored rhythm records and fall back to the mock catalogue without crashing the app.

## 10. Validation Requirements

Future persisted rhythms must validate before save and after load. Validation must reject:

- missing IDs,
- blank titles,
- invalid categories/areas,
- missing minimum/normal/full versions,
- invalid schedule hints,
- unknown fields unless explicitly allowed by the import/export schema,
- task-like payloads masquerading as rhythm templates,
- root or legacy localStorage payloads.

Invalid rhythms must not save. Invalid stored rhythms must not crash screens or create Today tasks.

Normalization may prepare user-entered form values before validation, but normalization must not repair unknown or unsafe imported payloads during import validation.

## 11. Testing Requirements For The Future Write PR

Before Library rhythm persistence is enabled, tests must cover:

- saving and reloading one user-created rhythm,
- invalid rhythm data does not save,
- duplicate ID handling follows the approved rule,
- duplicate title stays separate from identity,
- user-created rhythm does not replace built-in/mock rhythms,
- Enable rhythm does not create a Today task,
- Disable rhythm does not delete rhythm data,
- Add to Today does not persist through the Library rhythm write path,
- no active task writes occur,
- no scheduler execution occurs,
- no localStorage/root app access occurs,
- no migration execution occurs,
- no import/restore execution occurs,
- settings save/reset/export/import-validation tests continue to pass,
- existing screen and smoke tests continue to pass.

## Next PR Gate

If this contract is accepted, the next safe step is a Library rhythm backup/export and import-validation preview contract or implementation. The app should not persist Library rhythms until a rhythm-specific recovery path exists and tests prove the settings backup remains settings-only.
