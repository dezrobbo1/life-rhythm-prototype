# Settings Storage Contract

This contract prepares the first safe `/app` persistence step. It defines the settings shape that may be saved later, but this PR does not write to Dexie, IndexedDB, localStorage, or any migration target.

## Scope

Settings are the first approved persistence candidate because they are a single user-preference record and do not create tasks, schedule rhythms, or touch the root GitHub Pages app.

The settings contract covers:

- theme preference,
- Start Boost safety preferences,
- Life Shape settings.

## Save-First Fields

The first write PR may save only the settings record after validation.

Safe first fields:

- `theme`: `exhale`, `clear`, or `grounded`.
- `startBoostSafety`: user preferences for avoiding food rewards, shopping rewards, scrolling rewards, urgency countdowns, accountability prompts, and streak pressure.
- `lifeShape`: schema-backed setup preferences for work hours, travel/commute, fixed commitments, transition buffer, meal anchors, sleep/wake anchors, and low-capacity day preference.

The first write must not create active tasks, library rhythms, history, completion logs, Start Boost logs, dev tickets, migration logs, or reset logs.

## Deferred Fields And Behaviors

Deferred until later PRs:

- Add one-off persistence.
- Create rhythm persistence.
- Library enable/disable persistence.
- Quick pack persistence.
- Scheduler or capacity calculations.
- Legacy `lifeRhythm_v146` migration execution.
- Import execution.
- Reset execution.
- Dev ticket persistence.

Library rhythms are intentionally deferred because they require template identity, duplicate handling, enablement semantics, export/import decisions, and future scheduler rules.

## Validation Rules

All settings writes must parse through the Zod settings schema before storage.

Theme:

- must be one of `exhale`, `clear`, or `grounded`.

Start Boost safety:

- every safety field is boolean,
- omitted fields receive safe defaults,
- settings remain non-clinical support preferences.

Life Shape:

- work days must be valid weekdays,
- work start and end must be valid `HH:MM` times,
- work end must be later than work start,
- commute and travel minutes must be non-negative bounded integers,
- transition buffer must be a non-negative bounded integer,
- fixed commitments must have an id and label,
- fixed commitment end must be later than start when both are present,
- meal and sleep/wake anchors must be valid `HH:MM` times,
- low-capacity preference must be one of the supported contract values.

Missing optional Life Shape fields must produce safe defaults, not a broken settings record.

## Backup And Export Requirement

Before broader writes are added, the app needs a validated export/backup path.

For the first settings write:

- exported settings must parse back through import validation,
- invalid import data must be rejected safely,
- export must not include root app localStorage data unless a later read-only legacy backup task explicitly approves it,
- backup/export code must not run migration writes.

Broader task/rhythm persistence should wait until settings export and recovery are proven.

## Rollback Expectations

The first persistence PR should keep rollback simple:

- write only to the `/app` Dexie database namespace,
- store one settings record,
- preserve schema defaults when settings are missing or invalid,
- keep the app usable if settings cannot be read,
- allow a future settings reset to delete or replace only the `/app` settings record,
- never clear root app storage as part of `/app` rollback.

If a settings read fails, the app should fall back to validated defaults.

## Root App Protection

The current root GitHub Pages app remains the live production app.

Protected root files:

- `/index.html`
- `/manifest.json`
- `/service-worker.js`
- `/README.md`

Protected legacy data:

- `lifeRhythm_v146`
- previous root app backup/migration keys

The `/app` settings write must not read or write localStorage during normal startup. Legacy inspection and migration planning remain read-only until a later migration PR explicitly approves execution.

## Recommended Next PR

The next PR should implement settings persistence only:

- add a small settings repository over the existing `/app` Dexie database,
- validate settings before write and after read,
- wire persisted settings into the app snapshot provider,
- keep selectors pure,
- keep Add one-off and Create rhythm in memory,
- keep migration planning read-only,
- add tests for write/read/update/fallback/export validation.

Do not add scheduler behavior, task persistence, rhythm persistence, localStorage writes, backend services, accounts, sync, analytics, notifications, calendar integration, scoring, streaks, or gamification.
