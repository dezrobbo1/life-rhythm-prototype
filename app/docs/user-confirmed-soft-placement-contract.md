# User-Confirmed Soft Placement Contract

This contract defines the future boundary for user-confirmed soft task placement in Life Rhythm.

It does not implement task placement. It does not approve automatic scheduling, calendar integration, AI placement, notifications, backend sync, import/restore execution, migration execution, or any new write path in this PR.

Soft placement is the step after read-only soft suggestions. It may later let the user confirm that a Today task belongs in a broad, user-approved block, but it must stay local, movable, removable, and non-punitive.

## 1. Core Rule

Soft placement is user-confirmed only.

Read-only suggestions do not place anything. A suggestion is just a possible fit surfaced for review. Nothing moves, no task state changes, and no placement record is created until the user explicitly accepts or edits the suggestion.

Future product rules:

- The scheduler suggests.
- The user chooses.
- The app records only the user-confirmed local placement.
- The placement remains soft, reversible, and explainable.
- No task is placed because a gap merely exists.

## 2. What Soft Placement Is

A soft placement is a local note that a task may fit in a broad Life Shape block for a specific day.

Soft placement may later capture:

- a task the user already chose to keep active in Today,
- the Life Shape block the user explicitly confirmed,
- a broad start and end window,
- the reason the placement seemed useful,
- whether the placement has since been moved, removed, or completed from Today.

Soft placement is not:

- a calendar event,
- a deadline,
- a notification,
- a recurrence engine,
- compliance tracking,
- productivity scoring,
- a promise that the task must happen,
- proof that the user failed if it changes.

## 3. Read-Only Suggestions Boundary

Read-only soft suggestions remain non-mutating.

They may show:

- where a Today task could fit,
- which `openCapacity` block is involved,
- which `askFirst` block might be usable only with explicit confirmation,
- time-edge context such as usefulness windows,
- plain explanations like "No schedule created."

They must not:

- write placement records,
- move tasks,
- change active task status,
- write scheduler output,
- write calendar events,
- infer that blank time is available,
- treat `askFirst` blocks as already available,
- turn missed or changed windows into pressure.

## 4. Approved Future Write Target

A later PR may add local persistence for user-confirmed soft placements only.

The approved future write target is:

- local soft placement records created from explicit user confirmation.

This does not approve:

- automatic placement,
- scheduler-owned placement,
- AI-owned placement,
- calendar writes,
- notifications,
- backend sync,
- task completion history,
- scoring,
- streaks,
- compliance tracking,
- recurrence generation,
- catch-up queues.

## 5. Future Placement Data Contract

Future soft placement data should capture only the fields needed to explain and revise a local placement.

Approved future fields:

- `id`: stable placement identifier.
- `taskId`: active task identifier.
- `taskTitleSnapshot`: task title at the time of placement.
- `date`: local date the placement applies to.
- `blockId`: Life Shape block identifier.
- `blockLabelSnapshot`: block label at the time of placement.
- `start`: soft placement start time.
- `end`: soft placement end time.
- `placementSource`: `userConfirmed`.
- `createdAt`: creation timestamp.
- `updatedAt`: last update timestamp.
- `status`: one of `planned`, `moved`, `removed`, or `completedFromToday`.

Fields that must not be added to the placement model:

- score,
- streak,
- productivity score,
- compliance flag,
- penalty,
- failure marker,
- shame label,
- hidden scheduler authority,
- calendar event ID unless a later calendar contract explicitly approves it.

## 6. Placement Status Meaning

Future placement statuses should stay practical and non-punitive.

- `planned`: the user confirmed this soft placement.
- `moved`: the user moved the placement to another allowed block or time.
- `removed`: the user removed the placement without deleting the task.
- `completedFromToday`: the task was completed through the Today task flow.

Status rules:

- Moving a placement must not mark the task failed.
- Removing a placement must not delete the task.
- Completing from Today may close or mark the placement complete, but must not create scoring or compliance history.
- A changed time window should lead to re-entry choices, not punishment.

## 7. Life Shape Block Rules

Protected, recovery, and family time remain unavailable by default.

Placement rules by block type:

- `openCapacity`: may be offered for confirmation when the user has marked it available.
- `askFirst`: may be shown as a possibility, but requires explicit confirmation copy before placement.
- `protectedTime`: unavailable by default.
- `recoveryTime`: unavailable by default.
- `familyTime`: unavailable by default.
- `looseTime`: unavailable unless the user explicitly opens it.
- `householdFlow`: ask-first unless the user explicitly opens it.

Blank time is not available by default. The app must not infer capacity from empty space between blocks.

## 8. Ask-First Confirmation

`askFirst` blocks need stronger confirmation than `openCapacity` blocks.

Future confirmation copy should make clear:

- this block is not automatically available,
- the user may still be doing life in this time,
- placement is optional,
- no schedule is created until the user confirms,
- the placement can be removed later.

Example copy:

- "Use this block this time?"
- "This block is normally ask-first."
- "Nothing moves unless you confirm."
- "You can remove this later."

The app must not use ask-first confirmation as a way to pressure the user into opening protected or loose time.

## 9. Re-Entry And Time-Edge Rules

Missed or changed useful windows trigger re-entry, not punishment.

Future soft placement may use time-edge fields as context:

- `dueBy`,
- `fixedAt`,
- `expiresAfter`,
- `latestUsefulStartAt`,
- `notUsefulAfter`,
- `minimumStillUsefulAfterDeadline`.

Rules:

- A time edge describes when an action is useful.
- A changed useful window should offer review, park, not today, or minimum-version choices.
- The app must not create catch-up piles.
- The app must not auto-reschedule tasks after a useful window changes.
- The app must not label the user or task with shame language.
- Minimum still counts when it helps.

Allowed copy:

- "Useful window changed."
- "Still safely held."
- "Minimum still counts."
- "No catch-up pile."
- "Choose what still helps."

Forbidden copy:

- overdue,
- late,
- failed,
- urgent,
- behind,
- score,
- streak,
- productivity score,
- compliance.

## 10. Calendar Boundary

Soft placement is not a calendar event.

Future soft placement must not:

- create native calendar events,
- write iOS calendar entries,
- write external calendar entries,
- subscribe to calendar data,
- assume calendar permission,
- send placement data to a calendar provider.

Calendar read or write behavior requires a separate approved calendar contract, explicit user permission model, backup strategy, and tests.

## 11. AI Boundary

Soft placement must not add AI placement.

Future AI may eventually suggest wording or patterns only after a separate AI proposal contract. AI must not:

- place tasks,
- decide what the user should do,
- write placement records,
- write task state,
- write calendar events,
- infer protected time availability,
- create pressure,
- score,
- diagnose,
- enforce.

AI suggestions must remain pending until the user accepts, edits, or dismisses them.

## 12. Explicit Non-Goals

This contract does not approve:

- automatic placement,
- AI placement,
- calendar writes,
- notifications,
- recurrence engine behavior,
- hidden scheduler behavior,
- auto-rescheduling,
- catch-up queues,
- backend storage,
- cloud sync,
- upload,
- analytics,
- import/restore execution,
- migrations,
- medical language,
- treatment language,
- compliance language,
- scoring,
- streaks,
- gamification.

## 13. Future Testing Gates

Before user-confirmed soft placement is implemented, future PRs must test:

- a read-only suggestion does nothing until accepted,
- accepting into `openCapacity` creates only one local soft placement,
- accepting an `askFirst` possibility requires explicit confirmation copy,
- unavailable blocks cannot be accepted,
- protected, recovery, and family time remain unavailable by default,
- blank time is not treated as available,
- removing a placement does not delete the task,
- moving a placement does not mark the task failed,
- changed useful windows trigger re-entry choices, not punishment,
- no catch-up pile is created,
- no calendar writes occur,
- no backend or sync calls occur,
- no AI placement occurs,
- no writes occur outside the local placement record,
- no settings, Library rhythm, task history, completion log, import/restore, or migration writes occur,
- forbidden copy is absent,
- existing settings, Library, active task, backup, Plan, Today, and screen tests continue to pass.

## 14. Next PR Gate

If this contract is accepted, the next implementation step should still be narrow.

Recommended sequence:

1. Add schema support for local soft placement records.
2. Add a local repository with validation and no scheduler ownership.
3. Add user-confirmed placement from read-only suggestions.
4. Add remove/move behavior.
5. Add backup/export and import-validation preview before broader placement restore.

Do not add scheduler ownership, calendar integration, AI integration, backend sync, notifications, import/restore execution, migration execution, or automatic task placement until those boundaries have separate approved contracts and tests.

## 15. Current Backup Boundary

Soft placement backup/export and backup validation preview are now approved as local-only support surfaces.

The soft placement backup includes saved soft placement records only, including records whose status is `removed`. Removed records stay in the backup because `removed` is an explicit local placement state, not a deletion instruction.

Soft placement backup must not include:

- active tasks,
- settings,
- Library rhythms,
- scheduler output,
- calendar data or calendar event IDs,
- AI suggestions,
- backend or sync metadata,
- score, streak, productivity, or compliance fields,
- root or legacy app data.

Backup validation preview remains read-only. It must not restore, import, move, edit, remove, place, or delete anything.
