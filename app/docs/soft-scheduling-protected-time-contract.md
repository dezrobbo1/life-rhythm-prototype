# Soft Scheduling And Protected Time Contract

Status: Current boundary contract; the current Pool-based suggestion and user-confirmed placement subset is documented in `app/docs/life-rhythm-current-design-spec.md`.

Implementation boundary: this document governs future scheduler-owned behavior. It does not describe or revoke the already-implemented user-confirmed local placement writes, and it does not authorize automatic scheduling, calendar writes, AI writes, or cloud sync.

This contract defines the future boundary for soft scheduling, protected time, loose time, recovery blocks, deadline/time-edge handling, and no-catch-up re-entry.

It does not approve or implement scheduler behavior, calendar integration, AI integration, migration execution, import/restore execution, or any new persistence write.

Life Rhythm planning should stay user-led. The app may eventually help suggest where things could fit, but it must not quietly convert every gap into task space.

## 1. Product Principle

**Not every unscheduled gap is available.**

An empty-looking block on a calendar or plan may still contain recovery, travel, waiting, family responsibilities, transition time, household flow, sensory decompression, or simply the human cost of shifting from one thing to another.

Future scheduling must treat time as lived time, not just blank space.

Product rules:

- A visible gap is not automatically available capacity.
- A task should not be placed in protected or loose time unless the user explicitly opens that time.
- Recovery and transition time are real, even when they do not look like fixed commitments.
- The app should support soft planning without creating pressure to fill the day.
- Planning should keep "No catch-up pile" as a core behavior.

## 2. Time Block Types

Future scheduling may reason about these user-facing block types:

- `fixedCommitment`: appointments, school runs, meetings, booked events, or other fixed commitments.
- `work`: usual work hours or known work focus blocks.
- `sleep`: sleep and wake anchors, including wind-down and wake-up edges when configured.
- `meal`: meal anchors and meal-adjacent setup/cleanup time.
- `protectedTime`: time the user wants kept clear by default.
- `recoveryTime`: decompression, reset, low-demand rest, or after-load recovery.
- `looseTime`: unstructured time that may be useful, but is not automatically available.
- `householdFlow`: household routines, chores, care tasks, and home movement that may not be precisely timed.
- `familyTime`: family, partner, parenting, care, or social time that should not be treated as open capacity.
- `openCapacity`: time the user has explicitly allowed the app to consider for suggestions.

These types are future planning context. This contract does not add a scheduler table, calendar table, or new write path.

## 3. Protected And Loose Time Meaning

Protected time and loose time are not empty productivity space.

Protected time means the user wants the app to keep that time clear unless they deliberately choose otherwise. The user may still be resting, recovering, preparing, traveling, doing family work, handling sensory load, or simply not available for task placement.

Loose time means the time is unstructured, but not automatically open. It can stay intentionally unplanned. The app may eventually ask whether the user wants to open some of it, but it must not assume that loose time can absorb tasks.

Rules:

- The user may still be doing things during protected or loose time.
- Protected time must be treated as unavailable by default.
- Loose time must be treated as unavailable unless the user opens it.
- The scheduler must not place tasks in protected or loose time unless the user explicitly allows it.
- The app should explain that hidden life load can be protected without needing to justify it.

## 4. Scheduling Boundary

Future scheduler work may suggest placements only.

The future scheduler may:

- suggest a broad block where a task could fit,
- suggest shrinking to the minimum version,
- suggest moving something later,
- suggest parking a task,
- suggest choosing "not today",
- suggest placing a task after a fixed commitment,
- explain why a task was suggested in plain user-facing terms.

The future scheduler must not:

- silently fill the day,
- silently stack missed tasks,
- create catch-up piles,
- punish skipped or missed tasks,
- write calendar events,
- create pressure language,
- score the user,
- auto-create active tasks from enabled rhythms,
- expose debug or internal scheduling metadata on the daily UI.

Scheduler output must remain separate from persisted active tasks until a future scheduler write contract explicitly approves that boundary.

## 5. Re-Entry Rules

Missed, skipped, parked, and not-today tasks are safely held. They are not failures.

Future re-entry behavior should resurface tasks only at sensible re-entry moments, such as:

- Review tomorrow,
- a user-opened planning surface,
- a relevant broad day block,
- a chosen restart moment,
- after a fixed commitment when the user has allowed suggestions there.

Future re-entry options should include:

- do the minimum version,
- move later,
- park safely,
- mark not today,
- mark no longer needed,
- choose another task,
- restore a hidden item when the user asks.

Rules:

- Missed tasks must not auto-stack into Today.
- Skipped tasks must not be shown as failure.
- Parked tasks should remain safe and findable.
- Minimum done counts and should not require catch-up.
- No re-entry flow should imply penalty, judgement, or duty-to-perform framing.

## 6. Deadline And Time-Edge Rules

Future deadline handling should describe usefulness windows, not pressure.

Approved future time-edge types:

- `flexible`: useful at any reasonable time.
- `dueBy`: useful before a date or time.
- `fixedAt`: tied to a fixed time or commitment.
- `expiresAfter`: no longer useful after a date or time.

Potential future fields:

- `timeConstraint`
- `dueAt`
- `fixedAt`
- `expiresAfter`
- `latestUsefulStartAt`
- `notUsefulAfter`
- `minimumStillUsefulAfterDeadline`

Rules:

- Deadline tasks should preserve latest-useful windows.
- `latestUsefulStartAt` should help identify whether the minimum version still fits.
- `notUsefulAfter` should turn the task into a re-entry or follow-up choice, not a warning label.
- `minimumStillUsefulAfterDeadline` should allow the app to say whether a small version still counts.
- Tasks past a time edge should become calm choices: move, park, not today, follow up, or no longer needed.
- Deadline wording must avoid shame, punishment, productivity scoring, or failure framing.
- Time-edge data must not create calendar writes by itself.

## 7. Calendar Boundary

Calendar integration remains future work.

The first version of protected-time planning should support manual blocks before iOS or external calendar import. Manual blocks are enough to test the product model without taking on calendar permissions, write-back risk, or platform-specific behavior.

Future calendar principles:

- Manual blocks come first.
- Read-only calendar context should come before any write-back.
- Calendar context should be used to understand fixed commitments and protected edges, not to fill every gap.
- The app must not write native iOS calendar events in this PR.
- The app must not add calendar integration in this PR.
- Calendar write-back needs a separate approved contract, user permission model, backup strategy, and tests.

## 8. AI Boundary

AI integration remains future work.

AI may later suggest:

- pattern observations,
- hidden edges,
- rhythm packs,
- schedule preferences,
- possible protected-time rules,
- soft planning explanations.

AI must not directly:

- schedule tasks,
- decide what the user should do,
- diagnose,
- score,
- enforce,
- create pressure,
- write settings,
- write active tasks,
- write calendar events,
- execute imports or restores.

AI suggestions must remain pending until the user accepts, edits, or dismisses them. The app should present AI as optional support, not an authority.

## 9. Future Testing Gates

Before scheduler, protected-time, calendar, or AI behavior is enabled, future PRs must prove:

- protected time is never scheduled into by default,
- loose time is treated as unavailable unless the user opens it,
- open capacity is explicit,
- scheduler output is explainable in calm user-facing copy,
- missed tasks do not auto-stack,
- skipped tasks are safely held without failure language,
- parked tasks survive reload when persistence is approved,
- deadlines create latest-useful windows, not pressure language,
- time edges do not create scheduler output without an approved scheduler path,
- no calendar writes occur,
- no native iOS/calendar write integration is present,
- no AI automatic writes occur,
- no scheduler writes occur without a future approved write contract,
- no import/restore execution occurs,
- no migration execution occurs,
- existing settings, Library, active task, backup, and screen tests continue to pass.

## Next PR Gate

If this contract is accepted, the next scheduler-adjacent step should be a narrow manual-block or view-model design pass that keeps all scheduling output read-only and explainable.

Do not add scheduler behavior, calendar integration, AI integration, import/restore execution, migration execution, or new persistence writes until those boundaries have their own approved contracts and tests.
