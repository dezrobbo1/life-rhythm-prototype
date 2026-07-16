# Today Active Task Persistence Contract

Status: Historical pre-implementation contract. Retained for the active-task persistence rationale; it is not a current implementation status report.

Current implementation status: active Today task persistence and selected backup/validation are implemented in `/app`; Task Pool capture, holding, deferral, and Pool-to-Today flow are also current. Use `app/docs/life-rhythm-current-design-spec.md` and `app/docs/DOCUMENTATION_AUTHORITY.md` for current behavior. References below to “future,” “still local UI state,” or “first active-task write PR” describe the earlier decision point.

This contract defines the next major persistence boundary for Today active tasks. It does not approve or implement active task persistence, scheduler behavior, calendar integration, migration execution, restore/import execution, or any new write path.

The current app already has settings persistence, settings backup, Library rhythm persistence for user-created templates, Library rhythm backup export, and Library rhythm backup validation preview. Today is the next trial blocker because Add to Today, Add one-off, task progression, completion, parking, skipping, missed handling, and re-entry are still local UI state only.

Life Rhythm should keep Today user-led: active tasks are created by explicit user actions, not by automatic generation or a hidden scheduler.

## 1. Approved Future Write Target

A future PR may persist **active Today tasks created from user actions only**.

Approved future active-task creation sources:

- Add to Today from a Library rhythm.
- Add one-off Today task.
- A custom active task explicitly created by the user for Today.

This future write target is not scheduler output. It must not create tasks automatically, seed default tasks, or turn enabled Library rhythms into active tasks without a user action.

## 2. Still Not Approved

These fields and behaviors remain outside this contract:

- scheduler execution,
- automatic task generation,
- automatic catch-up piles,
- automatic placement from enabled Library rhythms,
- calendar integration,
- notification integration,
- import/restore execution,
- migration execution,
- full app reset,
- completion analytics,
- scores, streaks, badges, points, or gamification,
- productivity scoring,
- backend, accounts, sync, analytics, or GitHub API integration.

The future Today write must stay local-first, non-clinical, and calm on the surface.

## 3. Active Task Fields

A future active-task write may persist fields needed to recreate a user-created Today task and its calm task state.

Approved future fields:

- `id`: stable active task ID.
- `source`: one of `library`, `adhoc`, or `custom`.
- `templateId`: required when the task is created from a Library rhythm.
- `title`: user-visible task title.
- `area`: task area/category.
- `purpose`: optional one-line purpose.
- `minimum`: minimum version that counts.
- `normal`: optional normal version.
- `full`: optional full version.
- `hiddenEdges`: optional list of prep, setup, travel, cleanup, transition, decompression, or custom hidden edges.
- `scheduleHints`: optional user-entered timing hints, not scheduler output.
- `status`: current calm task state.
- `showToday`: whether this task belongs in Today.
- `createdAt`: creation timestamp.
- `updatedAt`: latest edit or state-change timestamp.
- `dueAt`: optional deadline timestamp.
- `notUsefulAfter`: optional timestamp after which the task should become a re-entry choice.
- `latestUsefulStartAt`: optional timestamp for latest useful start.
- `timeConstraint`: optional time-edge type.
- `missedPolicy`: optional user-visible re-entry policy.
- `minimumStillUsefulAfterDeadline`: optional boolean for whether minimum still counts after the time edge.

These fields must validate before save and after load. Unknown task-like payloads from imports must be rejected until active-task import validation exists.

## 4. Status Model

Future active tasks should use calm states that describe what happened without shaming the user.

Approved future statuses:

- `active`: available in Today.
- `inProgress`: started and currently being worked on.
- `paused`: safely stopped for now and resumable.
- `minimumDone`: minimum version completed; that counts.
- `done`: task completed beyond minimum or explicitly finished.
- `parked`: safely held out of the next-action slot.
- `skipped`: intentionally hidden without judgement.
- `missed`: a time edge passed and re-entry is needed.
- `notToday`: moved out of Today.
- `archived`: no longer active or no longer needed.

State semantics:

- `skipped` is not failure.
- `missed` is not failure.
- `parked` means safely held.
- `minimumDone` counts.
- `archived` or no-longer-needed removes the task from active Today without deleting unrelated records.

Status changes must be user-visible and reversible where practical. The app should avoid pressure language and avoid presenting missed tasks as a catch-up pile.

## 5. Deadline And Time-Edge Model

Future active tasks may include non-punitive time constraints.

Approved future time constraints:

- `flexible`: useful at any reasonable time.
- `dueBy`: useful before a due time or date.
- `fixedAt`: tied to a fixed time or commitment.
- `expiresAfter`: not useful after a specific time or date.

Potential fields:

- `timeConstraint`
- `dueAt`
- `notUsefulAfter`
- `latestUsefulStartAt`
- `missedPolicy`
- `minimumStillUsefulAfterDeadline`

Rules:

- Deadline tasks should preserve latest useful windows.
- A task past its time edge should become a re-entry or follow-up choice.
- The app must not use shame, punishment, pressure, or judgement language.
- The app must not imply treatment, diagnosis, or clinical monitoring.
- Time edges do not create scheduler output by themselves.

Example `missedPolicy` values for a future schema:

- `ask`: ask what should happen next.
- `park`: move out of the next-action slot.
- `reschedulePrompt`: offer a low-pressure re-entry choice.
- `convertToFollowUp`: create a follow-up only when the user confirms in a later approved PR.
- `hideUntilReview`: hide until Review tomorrow or another re-entry surface.

## 6. Add To Today Boundary

Add to Today is user-triggered only.

Future Add to Today persistence may create exactly one active task from a selected Library rhythm. It must not:

- persist Library enablement,
- duplicate active tasks silently,
- create multiple tasks,
- activate other rhythms,
- create scheduler output,
- create completion history,
- create a catch-up pile,
- automatically create more tasks later.

Duplicate handling must be explicit. A future write PR should decide whether duplicate Add to Today attempts are rejected, surfaced as an existing Today task, or allowed as separate active tasks with separate IDs.

## 7. One-Off Boundary

Add one-off is for today-only active tasks.

Future one-off persistence may create an active task with `source: "adhoc"` and `showToday: true`. It must not:

- add the task to Library,
- convert the task into a reusable rhythm,
- persist Library enablement,
- create scheduler output,
- survive as a repeating rhythm unless a later PR explicitly approves promotion to Library.

One-off tasks should be exportable later through an active-task backup format, not through the Library rhythm backup.

## 8. Completion And Re-Entry

Future active-task persistence should support completion and re-entry without turning Today into a pressure system.

Future behavior:

- Minimum done counts.
- Stop here can remove the task from the next-action slot.
- Keep going keeps the same task visible and may reveal normal/full versions.
- Choose another can show the next active task.
- Park keeps the task safe and out of the immediate slot.
- Skip hides the task without judgement.
- Missed creates re-entry options.
- Not today moves the task out of Today.

The first active-task write PR does not need full completion history. It may persist task state first, as long as backup/export and validation requirements are clear before broad writes.

## 9. Hidden Edges

Future active tasks may capture and display hidden edges so a task feels more realistic.

Approved hidden-edge categories:

- prep,
- setup,
- travel or move,
- cleanup,
- follow-up,
- transition,
- decompression,
- custom text entered by the user.

Rules:

- Hidden edges do not create tasks by themselves.
- Hidden edges do not schedule anything by themselves.
- User-entered hidden edges override defaults.
- Suggestions must be optional.
- Hidden edges should remain visible support, not hidden automation.

## 10. Scheduler Boundary

Scheduler behavior remains future work and is not approved by this contract.

A future scheduler may suggest:

- shrink to minimum,
- move later,
- park for tomorrow,
- place after a fixed commitment,
- mark not today,
- show a re-entry prompt after a missed time edge.

A future scheduler must not:

- silently stack missed tasks,
- silently fill the day,
- create pressure,
- write calendar events,
- score the user,
- create automatic catch-up piles,
- create active tasks from enabled Library rhythms without a user action.

Scheduler recommendations must be separate from persisted active task records until a later scheduler contract and write PR explicitly approve that boundary.

## 11. Backup And Export Requirement

Before active task writes become broad, the app needs an active-task recovery path.

Requirements:

- Active task backup/export must be defined before broad active-task writes.
- Active task import validation preview must exist before restore execution.
- Settings backup remains settings-only.
- Library rhythm backup remains Library-only.
- Active task backup must not include root GitHub Pages localStorage data.
- Active task backup must not include legacy `lifeRhythm_v146` data.
- Active task restore/import execution remains blocked until a separate PR explicitly approves it.

The first active-task write PR may be narrow, but it must not make users depend on unrecoverable task data.

## 12. Testing Requirements For The Future Write PR

Before active task persistence is enabled, tests must cover:

- Add to Today persists one active task.
- Add one-off persists one active task.
- Minimum done records task state.
- Stop here removes the task from the next-action slot.
- Keep going does not erase minimum-done state.
- Parked state survives reload.
- Skipped state survives reload.
- Missed state survives reload.
- Not today survives reload.
- Deadline and time-edge fields validate.
- Invalid deadline fields do not save.
- Duplicate Add to Today behavior follows the approved rule.
- Add to Today does not persist Library enablement.
- Add one-off does not create a Library rhythm.
- No scheduler execution occurs.
- No settings writes occur from the active-task repository.
- No Library rhythm writes occur from the active-task repository.
- No import/restore execution occurs.
- No migration execution occurs.
- No localStorage access occurs.
- Existing settings tests continue to pass.
- Existing Library rhythm persistence, backup export, and backup validation tests continue to pass.
- Existing screen and smoke tests continue to pass.

## Next PR Gate

If this contract is accepted, the next safe step is an active-task backup/export and import-validation design, or a very narrow active-task persistence PR that first proves Add one-off and Add to Today can write exactly one validated active task without scheduler behavior.

Do not add scheduler behavior, calendar integration, import/restore execution, migration execution, or automatic task generation until those boundaries have their own approved contracts.
