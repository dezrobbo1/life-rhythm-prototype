# Personal Trial Readiness Report

Status: Conditional readiness for a private Personal Trial v1 after merged PR #104 and post-merge verification; Task Pool backup follow-up is implemented in the current working tree

Scope: Local-first Life Rhythm `/app` through merged PR #104 on `main`, with the narrow Task Pool export/check follow-up in this working tree

This report is subordinate to `app/docs/life-rhythm-current-design-spec.md` and `docs/DOCUMENTATION_AUTHORITY.md`.

This report is the readiness note for a limited shell/usability trial. It does not approve a full soft-scheduling product trial, external tester onboarding, cloud sync, import/restore, calendar integration, AI suggestions, automatic scheduling, or public signup.

## 1. Readiness Verdict

The merged `main` branch is suitable for a private, manual Personal Trial v1 after the timezone-safe test fixtures, documentation reconciliation, and a fresh Pool → Plan walkthrough are complete. Use one browser, one device, and one stable URL.

The trial should test the current task capture, safe holding, Pool soft-suggestion, user-confirmed placement, Today, Reset, re-entry, local-first, backup-boundary and mobile flows. It is not a validation of the complete repeating-rhythm product.

The full intended soft-scheduling loop still requires repeating rhythm instances, broader resurfacing, backup recovery beyond read-only checks, and the remaining placement boundaries.

The app is not ready for external tester rollout yet. External trials should wait for operational Clerk invite-only verification, stronger onboarding, continued design-board review, and at least one completed personal trial.

## 2. Trial URL And Device Discipline

Use one browser, one device, and one stable URL for the whole trial.

Recommended:

- Use the merged stable Vercel app URL for the trial, not rotating PR preview URLs.
- If using a PR preview intentionally, write down that exact URL and do not switch during the trial.
- Use one browser profile on one device.
- Avoid clearing browser data during the trial unless the trial is being restarted deliberately.
- Do not compare data across different Vercel preview URLs. Each preview URL may have separate local browser storage.

The previously reviewed stable Vercel app URL is:

`https://life-rhythm-prototype.vercel.app/`

Confirm the final trial URL after this readiness report PR is merged.

## 3. Current Testable Areas

The following areas are ready to test in a personal manual trial:

- Setup settings
- theme selection
- Start Boost safety settings
- Life Shape settings
- Time to leave alone blocks
- protected, recovery, family, loose, household, and open-capacity time blocks
- Today active tasks
- Add one-off with optional time edges
- Add Library rhythm to Today
- task start, pause, resume, minimum done, normal done, full done, and stop-here flow
- Re-entry review
- Park safely
- Mark not today
- Try the minimum helper copy
- Reset relief-valve actions
- Narrow Today
- Park extras safely
- Restart with one action
- Library custom rhythm creation
- Task Pool capture in Pool
- captured ad hoc tasks held outside Today
- captured, parked, not-today, deferred and ready-to-revisit Pool states
- Pool-to-Today movement after explicit user action
- Plan Day Shape preview
- Pool-based soft suggestions from eligible items
- Add soft placement from `openCapacity` suggestions only
- saved soft placements in Plan
- Remove placement
- remove and re-confirm the same soft placement identity
- View in Plan retains the saved placement date
- settings backup export and check
- Library rhythm backup export and check
- Today task backup export and check
- soft placement backup export and check
- Task Pool backup export and check, including deferred status and `bringBackAfter`
- auth-disabled local-first flow
- opt-in auth shell, if configured deliberately
- signed-in local profile separation, if auth is enabled
- legacy local setup handoff notice, if auth is enabled and legacy local data exists
- mobile layout basics

These areas test shell usability and the current task capture/hold/place spine. They do not yet test repeating rhythm instances, broad resurfacing, or backup recovery beyond read-only validation.
Pool items are not scheduled automatically and are not automatically added to Today.

## 4. Not Ready To Test Yet

These areas remain out of scope for the personal trial:

- `askFirst` placement acceptance
- move or edit soft placement
- repeating rhythm instances
- broader resurfacing for parked, not-today, and rhythm-instance tasks
- deadline/usefulness salience beyond the current Today task fields
- automatic scheduling
- scheduler-owned placement
- missed-task detection
- missed status persistence
- task history
- completion logs
- import/restore execution
- calendar integration
- iOS or native calendar integration
- AI suggestions
- cloud sync
- backend data storage
- notifications
- analytics
- external tester onboarding
- public signup
- Restore hidden items as a real restore action
- full app reset or destructive reset execution

If any of these feel missing during the trial, log them as future work rather than current defects.

## 5. Local-First And Auth Caveats

Life Rhythm remains local-first.

Important boundaries:

- Login may identify the user.
- Login must not silently upload Life Rhythm data.
- Auth is opt-in through environment variables.
- Auth disabled means the app uses the normal local profile.
- Auth enabled and signed in means the app uses a separate signed-in local profile.
- Signing in does not merge existing local data.
- Signing out does not delete local data.
- The handoff notice explains when existing local setup remains in the legacy local profile.
- Backup and export remain user-controlled.

Do not treat login as cloud sync. Data should not be expected to appear on another device.

## 6. Backup And Recovery Caveats

Backup export and backup checking are ready for confidence testing.

Backup boundaries:

- Settings backup includes settings only.
- Library rhythm backup includes saved custom Library rhythms only.
- Today task backup includes Today active tasks only.
- Soft placement backup includes saved soft placements only, including removed placement records as local state.
- Task Pool backup includes saved Pool rows, statuses, useful-window fields, and `bringBackAfter` deferral metadata.
- Task Pool backup does not include settings, Today tasks, Library rhythms, soft placements, calendar data, scheduler output, or restore/import execution.
- Backup checking validates a file only.
- Backup checking does not restore.
- Import/restore execution is not enabled.

During the trial, export backups deliberately and check at least one valid backup. Also paste invalid JSON into one checker to confirm the feedback is calm and clear.

## 7. Smoke QA Basis

The final smoke QA pass before this report fixed a trial-blocking clarity issue in Setup:

- Life Shape time block labels now follow the selected block type.
- Custom labels are preserved.
- The fix prevents an `openCapacity` block from visually reading as a protected-time block.

The smoke QA pass also confirmed the trial path at mobile width with no console warnings or errors at the time of review.

PR #80 then made the safe Reset relief-valve actions trial-functional:

- Narrow Today keeps the first visible Today task and marks extra visible Today tasks `notToday`.
- Park extras safely keeps the first visible Today task and marks extra visible Today tasks `parked`.
- Restart with one action surfaces the first visible Today task when available.
- Restore hidden items remains preview-only and not connected.
- Full app reset remains disabled and non-destructive for the trial.

PR #81 then applied a focused visual/design-board polish pass:

- Today hierarchy is more one-action-first.
- Task Card actions have clearer primary and secondary hierarchy.
- Setup backup/check areas are visually secondary.
- Library cards read more like a calm catalogue.
- Plan soft suggestions and placements are easier to scan.
- Reset relief actions read less like administration.
- Mobile hero, spacing, and backup preview layout were tightened.

## 8. Historical PR #81 Smoke Confirmation

The following is historical evidence from the PR #81 smoke pass; it does not replace a fresh walkthrough of the merged PR #104 `main` state.

The current trial-ready surface now includes:

- minimum, normal, and full task completion endpoints through existing task statuses
- fixed commitments clarity as notes-only for trial
- Trial limits copy in Setup
- mobile trial polish
- backup copy confidence pass
- Reset relief-valve functionality
- visual polish/design-board alignment pass through PR #81

This remains a personal manual trial surface, not an external tester release surface.

## 9. Known Risks For The Personal Trial

Known risks that should be watched closely:

- The design spec and authority map must be updated in the same PR as implementation-status changes.
- Visual polish is stronger after PR #81, but full design-board parity remains future work.
- The current app has Pool-based soft suggestions, but the suggestion model is deliberately limited to eligible Pool items and explicit open capacity.
- Re-entry remains partial until broader parked, not-today, and rhythm-instance resurfacing exists.
- Task Pool backup should be checked during the trial so saved Pool status and deferral metadata are understood.
- Vercel preview URLs may fragment local trial data.
- Backup checking may feel similar to restore even though restore is not connected.
- Auth may create a "where did my setup go" feeling if the user forgets signed-in profiles are separate.
- Soft suggestions may still need tuning so they read as suggestions, not instructions.
- Mobile backup textareas and Setup controls should be watched for cramped interaction.
- No automatic missed-task handling exists yet, so re-entry remains user-led and partial.

None of these block a limited shell/usability trial, but each should be logged if it causes friction.

## 10. Before Day 1

Before starting the trial:

1. Pick the exact trial URL.
2. Pick the exact browser and device.
3. Confirm whether auth is disabled or deliberately enabled.
4. Open Setup.
5. Choose the theme.
6. Review Start Boost safety settings.
7. Add Life Shape settings.
8. Add at least one Time to leave alone block.
9. Add at least one `openCapacity` block if soft placement will be tested.
10. Save settings.
11. Export a settings backup.
12. Check the settings backup.
13. Create one Library rhythm if Library persistence should be tested.
14. Add one Today task.
15. Open Pool and capture one item.
16. Export and check a Task Pool backup if Pool persistence should be tested.
17. Open Reset and confirm Narrow Today, Park extras safely, and Restart with one action are understandable.
18. Confirm the bottom nav and primary actions are comfortable on the trial device.

## 11. Daily Trial Routine

Use the short routine from `app/docs/personal-trial-launch-note.md`.

Minimum daily pass:

1. Open Today.
2. Check the next useful action.
3. Add one one-off if needed.
4. Add a time edge only if useful.
5. Start the task.
6. Pause, resume, mark minimum done, or finish at normal/full only if that fits.
7. Use Re-entry review only when it appears.
8. Open Pool and review safely held items.
9. Open Plan and check Day Shape and soft suggestions.
10. Add a soft placement only from `openCapacity` if useful.
11. Remove and re-confirm a soft placement at least once during the week.

No daily action should become a performance target.

## 12. Stop Conditions

Pause the trial and log the issue if:

- anything appears to upload, sync, import, restore, delete, or move data unexpectedly
- backup checking feels like it might change data
- Today starts feeling like a demand list
- Plan suggestions feel like commands
- soft placements feel hard to remove
- sign-in makes local data boundaries feel unsafe or unclear
- mobile layout hides a primary action
- saved local data disappears unexpectedly after reload
- copy feels shaming, pressuring, or too technical

Stopping early is still useful product learning.

## 13. Success Criteria

The personal trial is successful enough to continue if:

- Today stays focused on one useful next action
- the user can recover after disruption without shame
- minimum done feels like it counts
- normal and full completion feel optional
- Plan suggestions feel optional and explainable
- protected and loose time do not feel consumed by the app
- soft placements feel removable and non-punitive
- backup/export/check flows feel understandable
- auth, if used, feels clearly local-first
- no copy suggests failure, pressure, scoring, streaks, or required-adherence tracking
- the trial clarifies what repeating rhythms, broader resurfacing, and rhythm-instance backup need to do next

## 14. Recommended Next Step After The Trial

After the limited shell/usability trial, review the issue log before adding new product scope.

Likely next decisions:

- how repeating rhythm instances should avoid backlog or streak debt
- how broader parked, not-today, and rhythm-instance items should resurface
- whether the Task Pool export/check path is sufficient before longer trials
- whether `askFirst` placement should be contracted before acceptance
- whether Clerk invite-only settings should be operationally verified for external testers

The next product direction after the trial is repeating rhythm instances or visual/product refinement, chosen from trial evidence. Do not start another scheduler expansion before the current soft-suggestion boundaries are observed in use.

Do not start cloud sync, calendar integration, AI suggestions, import/restore execution, or external tester onboarding from this report alone.
