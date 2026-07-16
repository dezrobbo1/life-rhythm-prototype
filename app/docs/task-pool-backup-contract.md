# Task Pool Backup Contract

Status: Current and implemented; merged into `main` through PR #105

Scope: Local Task Pool export and read-only validation for the `/app` Personal Trial architecture.

## Purpose

Task Pool items are safely held local work. They need their own backup boundary so a user can preserve captured, deferred, parked, not-today, softly placed, Today-linked, or no-longer-needed Pool state without creating a whole-app restore path.

## Export boundary

The Task Pool backup contains all saved `taskPoolItems` rows, including their current status and supported task fields:

- title, area, source and status;
- minimum, normal and full versions;
- purpose and notes;
- template or rhythm-instance references when present;
- useful-window and deadline fields;
- `minimumStillUsefulAfterDeadline` and `missedPolicy` when present;
- `bringBackAfter` deferral metadata when present;
- created and updated timestamps.

The backup uses the separate `life-rhythm-task-pool-backup` format. It is not combined with settings, Library rhythms, active Today tasks, soft placements, or legacy root-app data.

Rows whose status is `noLongerNeeded` remain in the backup because status is explicit local state, not a deletion instruction. Deferred rows retain `bringBackAfter` so the held state remains explainable.

## Validation boundary

Task Pool backup checking:

- validates the format, timestamps, item schema and duplicate IDs;
- previews item count, status summary, deferred count, deferral metadata presence and titles;
- rejects mixed data classes such as settings, active tasks, placements, scheduler, calendar, AI, sync, legacy or log data;
- does not write to Dexie, localStorage or any other persistence layer;
- does not restore, import, move, edit, remove, place or delete anything.

The Setup screen exposes separate Export Task Pool backup and Check Task Pool backup controls. The export is downloaded locally when browser download APIs are available; no network call is made.

## Explicit non-goals

This contract does not approve:

- import or restore execution;
- merging Task Pool rows into another device or namespace;
- cloud sync, backend storage, analytics or upload;
- calendar data or calendar event IDs;
- scheduler-owned placement or automatic Today movement;
- AI suggestions or AI-written state;
- task history, completion logs, scoring, streaks or compliance data.

The next product step after this bounded backup path is visual/product validation of Pool, Plan and Today, followed by a separate rhythm-instance backup contract if repeating rhythms are implemented.
