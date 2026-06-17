# Deadline And Re-Entry Contract

This contract defines future handling for missed tasks, deadline-aware tasks, usefulness windows, latest useful start, and no-catch-up re-entry.

It does not approve or implement scheduler behavior, calendar integration, AI integration, import/restore execution, migration execution, or any new persistence write.

Life Rhythm should treat deadlines as context for useful choices, not as a pressure system.

## 1. Task Time Types

Future active tasks may use these time types:

- `flexible`: the task is useful at any reasonable time.
- `dueBy`: the task is useful before a date or time.
- `fixedAt`: the task is tied to a specific time, event, or commitment.
- `expiresAfter`: the task is no longer useful after a date or time.

Rules:

- A time type describes usefulness, not user worth or task importance.
- A task can become less useful after a time edge without becoming a failure.
- Time types must support calm re-entry choices when a window has passed.
- Time types do not create scheduler output by themselves.
- Time types do not create calendar writes by themselves.

## 2. Future Fields

Future schemas may add deadline and re-entry fields only after a later PR explicitly approves the write boundary.

Potential future fields:

- `timeConstraint`: one of `flexible`, `dueBy`, `fixedAt`, or `expiresAfter`.
- `dueAt`: date/time by which a task is useful.
- `fixedAt`: date/time tied to a fixed event or commitment.
- `expiresAfter`: date/time after which the task is no longer useful.
- `latestUsefulStartAt`: latest point where the task can still usefully begin.
- `notUsefulAfter`: date/time after which the task should become a re-entry choice.
- `minimumStillUsefulAfterDeadline`: whether the minimum version still helps after the main time edge.
- `missedPolicy`: user-facing rule for what to offer when a time edge passes.

Possible future `missedPolicy` values:

- `ask`: ask what should happen next.
- `park`: move safely out of the next-action slot.
- `notToday`: move out of Today.
- `minimumOnly`: offer the minimum version if it still helps.
- `followUpPrompt`: offer a follow-up only when the user confirms.
- `hideUntilReview`: hold until a review or planning surface.
- `archiveIfExpired`: mark no longer needed when the user confirms.

Validation requirements:

- Dates and times must be valid.
- `latestUsefulStartAt` must not be after `notUsefulAfter`.
- `dueAt`, `fixedAt`, and `expiresAfter` must match the selected `timeConstraint`.
- Unknown deadline fields must be rejected until the schema explicitly supports them.
- Invalid deadline fields must not save.

## 3. Task States

Future deadline and re-entry logic should work with calm task states:

- `active`: available in Today.
- `inProgress`: started and currently being worked on.
- `paused`: safely stopped for now and resumable.
- `minimumDone`: minimum version completed; that counts.
- `done`: completed or explicitly finished.
- `skipped`: intentionally passed over without judgement.
- `parked`: safely held outside the next-action slot.
- `missed`: a useful time window passed and re-entry is needed.
- `notToday`: moved out of Today.
- `archived`: no longer active or no longer needed.

State rules:

- `missed` is not failure.
- `skipped` is not failure.
- `parked` means safely held.
- `minimumDone` counts.
- `archived` should remove a task from active Today without deleting unrelated records.
- State changes should be visible and reversible where practical.

## 4. Re-Entry Behaviour

Missed tasks are safely held. They should not become a catch-up pile.

Future re-entry should offer low-pressure choices:

- move,
- park,
- do the minimum version,
- mark not today,
- mark no longer needed,
- choose another task,
- review later.

Re-entry rules:

- The app must not automatically stack missed tasks into Today.
- The app must not silently create replacement tasks.
- The app must not imply punishment, blame, or correction.
- A missed task may resurface at a sensible review moment, not every time the app opens.
- A skipped task may stay hidden until the user asks or a review surface invites it back.
- A parked task should remain findable and safe.
- A task marked no longer needed should leave active Today.

Suggested copy patterns:

- "Still safely held."
- "No catch-up pile."
- "Minimum still counts."
- "Move, park, or mark not today."
- "No longer needed is allowed."

Avoid copy that frames the user as late, bad, judged, or behind.

## 5. Deadline Principles

Deadline handling should use usefulness windows.

Principles:

- A deadline describes when an action is useful.
- A latest useful start helps decide whether the minimum version still fits.
- A task can pass a useful window and still need a calm next choice.
- The app should preserve the minimum version when it still helps.
- The app should offer follow-up or no-longer-needed choices when the original task is no longer useful.
- Deadline copy must avoid shame language.
- Deadline copy must avoid urgency manipulation.
- Deadline copy must not turn time into a score.

Examples:

- Before `latestUsefulStartAt`: suggest the minimum version if the user chooses.
- After `latestUsefulStartAt` but before `notUsefulAfter`: offer minimum, move, or park.
- After `notUsefulAfter`: offer follow-up, not today, no longer needed, or review later.

## 6. Scheduler Interaction

Future scheduler work may use deadlines only as context for suggestions.

The future scheduler may:

- notice latest useful windows,
- suggest the minimum version before a useful window closes,
- suggest moving a task out of Today,
- suggest parking a task,
- suggest review later,
- explain why a task is less useful after a time edge.

The future scheduler may not:

- create pressure,
- silently stack work,
- silently fill open time,
- create catch-up piles,
- auto-create replacement tasks,
- write calendar events,
- decide that a missed task must be done,
- expose internal scheduling/debug metadata in daily UI.

Scheduler output must remain separate from persisted task state until a later scheduler write contract explicitly approves that boundary.

## 7. AI Interaction

Future AI may suggest re-entry options, but it must not decide outcomes.

AI may later suggest:

- re-entry wording,
- a smaller minimum version,
- a hidden edge to consider,
- whether a task may be no longer useful,
- a follow-up prompt,
- a pattern the user can accept, edit, or dismiss.

AI must not:

- decide that a task is missed,
- decide that a task is no longer needed,
- schedule tasks directly,
- write task state,
- write calendar events,
- score the user,
- diagnose,
- enforce a plan.

AI suggestions must remain pending until the user accepts, edits, or dismisses them.

## 8. Future Testing Gates

Before deadline-aware persistence, scheduler interaction, or AI-assisted re-entry is enabled, future PRs must test:

- `flexible`, `dueBy`, `fixedAt`, and `expiresAfter` validate.
- Invalid time fields do not save.
- `latestUsefulStartAt` validates against `notUsefulAfter`.
- `minimumStillUsefulAfterDeadline` preserves minimum-version options.
- `missedPolicy` values validate.
- Missed tasks are safely held.
- Missed tasks do not auto-stack into Today.
- Skipped tasks do not reappear without an approved re-entry moment.
- Parked tasks remain findable and out of the next-action slot.
- No catch-up pile is created.
- Move, park, minimum version, not today, and no longer needed choices render.
- Scheduler does not silently stack work.
- Scheduler does not create pressure language.
- Scheduler does not write calendar events.
- AI suggestions do not write state automatically.
- No import/restore execution occurs.
- No migration execution occurs.
- No localStorage root app data is touched.
- Existing settings, Library, active task, backup, and screen tests continue to pass.

## Next PR Gate

If this contract is accepted, the next safe step is a schema-only design pass for deadline fields or a read-only view-model experiment that shows deadline-aware re-entry copy from fixtures.

Do not add scheduler behavior, calendar integration, AI integration, import/restore execution, migration execution, or new persistence writes until those boundaries have their own approved contracts and tests.
