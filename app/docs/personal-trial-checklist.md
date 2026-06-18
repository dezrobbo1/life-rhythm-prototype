# Personal Trial Checklist

Status: Draft checklist for a basic personal manual trial

Scope: Local-first Life Rhythm `/app` preview through PR #66

This checklist is for a small personal trial only. It is not an external tester onboarding guide, a public launch plan, or a request to add new product behaviour.

## 1. Trial Purpose

Use this trial to learn whether the current Life Rhythm loop feels calm, understandable, and recoverable during ordinary use.

Primary questions:

- Can Today stay focused on one useful next action?
- Can a task be started, paused, reduced to the minimum, parked, or moved out of Today without shame?
- Can Life Shape blocks make Plan feel more realistic without turning the day into a rigid timetable?
- Do soft suggestions feel like suggestions, not commands?
- Do soft placements feel local, removable, and non-punitive?
- Do backup/export/check areas feel understandable enough for a personal trial?
- Does the app avoid copy that implies failure, urgency pressure, scoring, streaks, or compliance?

## 2. What To Test

Test the current app as it exists now:

- Setup settings
- Life Shape time blocks
- Today active tasks
- Add one-off with time edges
- Re-entry review
- Park safely
- Mark not today
- Try the minimum helper copy
- Library custom rhythm creation
- Add Library rhythm to Today
- Plan Day Shape preview
- Plan soft suggestions
- Add soft placement from `openCapacity` only
- saved soft placements
- Remove placement
- settings backup export/check
- Library rhythm backup export/check
- active task backup export/check
- soft placement backup export/check
- mobile layout basics

## 3. What Not To Test Yet

These areas are intentionally not ready for trial validation:

- `askFirst` placement
- move/edit placement
- import/restore execution
- calendar integration
- AI suggestions
- cloud sync
- notifications
- external tester onboarding
- public signup
- automatic scheduling
- scheduler-owned placement
- external account/data operations

If one of these areas feels missing, log it as a future boundary note rather than a bug in the current trial.

## 4. Before The Trial

Use one browser/device profile for the trial.

Setup steps:

1. Open the current Vercel preview or local `/app` build.
2. Confirm auth is disabled unless explicitly testing the auth shell.
3. Choose a theme.
4. Set Start Boost safety preferences.
5. Add basic Life Shape settings:
   - work hours if relevant
   - commute/travel time if relevant
   - transition buffer
   - meal anchors
   - sleep/wake anchors
   - low-capacity day preference
6. Add at least one Life Shape time block:
   - one protected or recovery block
   - one `openCapacity` block if soft placement should be tested
7. Save settings.
8. Export a settings backup.
9. Check the exported settings backup if convenient.

Do not import or restore anything during this trial. Backup checking is read-only.

## 5. One-Week Trial Routine

Use this as a light rhythm, not a checklist to complete perfectly.

Daily start:

1. Open Today.
2. Check whether the next useful action feels visible early enough.
3. If needed, change "How today feels."
4. Start one task.
5. Use Pause, Resume, or Mark minimum done if they fit.
6. If the task has a changed useful window, read Re-entry review.
7. Use Park safely or Mark not today only when it feels right.

During the day:

1. Add one one-off task if something new matters today.
2. If relevant, add a time edge:
   - flexible
   - due by
   - fixed at
   - expires after
3. Confirm the time edge copy stays calm and does not feel like pressure.
4. Try Start Boost only when the start feels sticky.
5. Stop after the minimum when that is enough.

Planning check:

1. Open Plan.
2. Check Day Shape preview for the selected day.
3. Confirm protected, recovery, family, and loose time are not treated as automatically available.
4. Confirm blank time is not treated as available.
5. Review soft suggestions.
6. Add a soft placement only from an `openCapacity` suggestion.
7. Remove a placement at least once and confirm the task is not deleted.

Library check:

1. Create one custom rhythm.
2. Add it to Today.
3. Confirm the rhythm remains a reusable Library item.
4. Confirm Add to Today creates a Today task without changing Library enablement.

Backup check:

1. Export settings backup once.
2. Export Library rhythm backup after creating a custom rhythm.
3. Export active task backup after adding Today tasks.
4. Export soft placement backup after adding and removing at least one placement.
5. Use check/validation preview on at least one backup type.
6. Confirm checking a backup says it does not restore or change anything.

## 6. Daily Notes

At the end of each trial day, answer quickly:

- What was the first thing I noticed?
- Did Today feel too full, too empty, or about right?
- Did the next useful action feel helpful?
- Did "minimum done" feel like it counted?
- Did Re-entry review feel calm?
- Did Park safely or Mark not today feel safe to use?
- Did Plan feel like context, not command?
- Did any soft suggestion feel too directive?
- Did a soft placement feel removable?
- Did backup language make sense?
- Did any copy feel shaming, pushy, or too technical?
- Did anything feel hard specifically because of attention, memory, task switching, avoidance, sensory load, or low capacity?

## 7. Mobile Checks

On an iPhone-width screen or narrow browser viewport, check:

- bottom nav fits and remains usable
- cards are not hidden behind the bottom nav
- Add one-off modal is usable
- Create rhythm modal is usable
- backup textareas do not break the page
- primary actions are easy to tap
- labels are readable
- Plan soft suggestions and soft placements are understandable
- Setup Life Shape time blocks can be edited without horizontal scrolling

Log any screen where the page feels cramped, jumpy, or hard to tap.

## 8. Local-First And Auth Caveats

Current trial data is local-first.

Auth caveats:

- Auth is opt-in through environment configuration.
- If auth is disabled, the app uses the normal local profile.
- If auth is enabled and signed in, local data is separated by signed-in profile.
- Signing in does not upload Life Rhythm data.
- Signing out does not delete local data.
- Existing local setup may live separately from signed-in local profile data.

Trial rule:

- Do not treat sign-in as sync.
- Do not expect data to appear on another device.
- Use backup/export deliberately when testing recovery confidence.
- Do not test cloud sync because it does not exist yet.

## 9. Backup And Export Checks

For each backup type, test three things:

1. Export creates or explains the backup clearly.
2. Check/validation preview accepts a valid backup.
3. Check/validation preview rejects invalid pasted JSON with calm feedback.

Backup boundaries:

- Settings backup includes settings only.
- Library rhythm backup includes saved custom Library rhythms only.
- Active task backup includes Today active tasks only.
- Soft placement backup includes saved soft placements only, including removed placement records as local state.
- Backup checking is read-only.
- No restore/import execution exists yet.

## 10. Trial Success Criteria

A basic personal manual trial is successful enough to continue if:

- the user can recover after disruption without shame
- backups feel understandable
- Today does not feel overloaded
- Plan suggestions do not feel like commands
- soft placements feel removable and non-punitive
- no copy suggests failure, urgency, scoring, streaks, or compliance
- the app still feels local-first and user-controlled
- the missing features are understandable as future work, not broken promises

## 11. Stop Conditions

Pause the trial and log the issue if:

- Today repeatedly feels like a demand list
- soft suggestions feel like commands
- a placement feels hard to remove or feels like a commitment
- backup/check copy feels like it might change data when it should not
- any flow appears to import, restore, sync, upload, or delete data unexpectedly
- copy feels shaming or pressuring
- mobile layout blocks a primary action
- a saved item disappears unexpectedly after reload
- task, rhythm, or placement boundaries become unclear

## 12. Issue Log Template

Copy this block for each issue:

```md
### Issue

- Date:
- Screen:
- Action attempted:
- What happened:
- Expected behaviour:
- Emotional friction:
- ADHD-specific friction:
- Severity: Low / Medium / High / Stop trial
- Screenshot/reference:
- Suggested fix:
```

Severity guide:

- Low: Annoying or confusing, but trial can continue.
- Medium: Interrupts the flow or creates uncertainty.
- High: Blocks a key trial path or risks misunderstanding data boundaries.
- Stop trial: Makes the app feel unsafe, shaming, or likely to change/delete/upload data unexpectedly.

## 13. End-Of-Week Review

At the end of the week, review:

- Which screens were used daily?
- Which screens were avoided?
- Which backup/check areas were understandable?
- Which Life Shape blocks mattered?
- Did Re-entry review help?
- Did soft placements help or add mental load?
- Which missing feature was felt most strongly?
- What should be fixed before a longer personal trial?
- What should be fixed before any external tester sees the app?

Do not treat this review as a performance report. It is product learning.
