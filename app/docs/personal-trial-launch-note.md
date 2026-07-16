# Personal Trial Launch Note

Status: Short start note for Personal Trial v1 after merged PR #104 and post-merge verification

Scope: Private, single-user trial of the current `/app` capture, holding, soft-placement and re-entry spine. This is not an external tester launch or a full repeating-rhythm trial.

Use this note when starting the first Life Rhythm personal trial. For the fuller checklist and issue log, use `app/docs/personal-trial-checklist.md`.

## Trial Goal

Run Life Rhythm for ordinary daily use and learn whether it helps you restart, reduce load, and choose one useful next action without making the day feel heavier.

This is a manual product-learning trial, not an external tester launch.

## Stable URL And Device Rule

Use one browser, one device, and one stable URL for this trial.

Recommended:

- Use the same phone or computer for the whole trial.
- Use the same browser profile for the whole trial.
- Use a stable production or intentionally chosen preview URL and write it down before day 1.
- Avoid switching between Vercel preview URLs during the trial.

Vercel preview URLs can have separate local browser storage. If you create data on one preview URL, it may not appear on another preview URL even on the same device.

## Before Day 1

1. Open the chosen trial URL.
2. Confirm the app loads.
3. Choose a theme if needed.
4. Set Setup preferences and Life Shape blocks.
5. Add at least one `openCapacity` block if you want to test soft placement.
6. Save settings.
7. Export a settings backup.
8. Read the backup/check copy once so the boundary is clear.

Before starting, note that backups remain data-class-specific. Task Pool backup includes saved Pool rows and deferral metadata; soft-placement backup includes placements only. No backup restores data.

Do not treat login as cloud sync. Login may identify the trial user, but local Life Rhythm data stays local unless a future sync feature clearly says otherwise.

## Daily 10-Minute Routine

Use this once a day, preferably at the same rough time.

1. Open Today.
2. Check whether the next useful action feels clear.
3. Add one one-off task if something new matters today.
4. Add a time edge only if it helps describe when the task is useful.
5. Start one task, pause or mark minimum done if that fits.
6. Read Re-entry review if it appears.
7. Use Park safely or Mark not today only when you choose.
8. Open Pool and review safely held items.
9. Open Plan and review Day Shape, Pool soft suggestions, and saved soft placements.
10. Add a soft placement only from `openCapacity`.
11. Remove and re-confirm one placement during the week to confirm it feels safe.

Minimum still counts. No task needs to become a reusable rhythm unless you choose to create it in Library.

## Backup Reminder

Export backups deliberately during the week:

- settings backup
- Library rhythm backup
- Today task backup
- Task Pool backup
- soft placement backup

Task Pool backup includes saved Pool status and `bringBackAfter` metadata. These exports do not include unrelated data classes or restore/import execution.

Backup checking is read-only. Import/restore is not enabled.

Use backup checking only to see whether a file looks valid. It should not change anything on the device.

## Not Part Of This Trial

Calendar, AI, cloud sync, notifications, askFirst placement, move/edit placement, repeating rhythm instances, and broader resurfacing are not part of this trial.

Also do not test:

- import/restore execution
- external tester onboarding
- public signup
- automatic scheduling
- task placement outside user-confirmed `openCapacity`

If one of these feels missing, log it as future work rather than a current bug.

## Where To Log Issues

Use the issue log template in `app/docs/personal-trial-checklist.md`.

Log:

- screen
- action attempted
- what happened
- expected behaviour
- emotional friction
- ADHD-specific friction
- severity
- screenshot/reference
- suggested fix

## Stop Conditions

Pause the trial and log the issue if:

- the app appears to upload, sync, import, restore, delete, or move data unexpectedly
- a backup/check flow feels like it might change data
- Today feels like a demand list
- Plan suggestions feel like commands
- a soft placement feels hard to remove
- Pool holding or deferral data appears to disappear or cannot be explained
- mobile layout blocks an important action
- copy feels shaming or pressuring

The trial is useful even if it stops early. The point is product learning.
