# Soft Scheduling Loop Contract

Status: Future behaviour contract

Scope: Product model for task capture, repeating rhythms, soft suggestions, user-confirmed placement, re-entry, and usefulness windows.

This contract defines the intended Life Rhythm product spine. It does not implement behaviour, storage, scheduling, calendar integration, AI, sync, import/restore, notifications, or task history.

## 1. Product Premise

Life Rhythm is not a rigid scheduler.

Life Rhythm suggests.

The user decides.

The app does not own the day.

The intended loop is:

capture -> hold safely -> find soft window -> user confirms -> re-enter later if missed or deferred -> respect usefulness windows

The product should make it easier to hold and revisit intentions without turning the day into a timetable.

## 2. Research-Informed Rationale

The soft scheduling loop is based on these practical findings:

- Capture should be separate from doing. Capturing an intention should not immediately turn into a demand.
- Externalising intentions reduces working-memory demand. The app can safely hold a task so the user does not have to keep it active in mind.
- Today should stay deliberately small. The Today surface should show what fits now, not everything that exists.
- Blank time is not automatically available. People may be resting, transitioning, travelling, supporting family, recovering, or simply protecting unstructured time.
- Soft suggestions should use explicit open capacity. The app should prefer user-defined open capacity over inferred gaps.
- Missed or deferred tasks should not create a pile.
- Repeating rhythms should not create streak debt.
- Deadline and usefulness windows should prevent endless drift without shame language.

The goal is a system that can remember, surface, and explain options while leaving the final choice with the user.

## 3. Task Pool / Inbox Model

Life Rhythm needs a local task pool that can hold:

- ad hoc captured tasks
- repeating rhythm instances
- parked tasks
- not today tasks
- deferred tasks
- missed or unfinished tasks waiting for review

Rules:

- The task pool is not a guilt list.
- Captured tasks do not enter Today by default.
- Today remains a small active surface.
- Task pool items can be suggested later.
- Items can be marked no longer needed.
- The pool should support review without creating pressure to empty it.

The task pool is the safe holding area between capture and action.

## 4. Task Lifecycle Model

Conceptual lifecycle states:

- captured
- suggested
- softly placed
- Today
- in progress
- minimum done
- done
- parked
- not today
- bring back after
- no longer needed

User-facing states should stay simple:

- Today
- in progress
- minimum done
- done
- parked
- not today
- bring back later
- no longer needed

Internal states may be needed later for suggestion ranking, rhythm windows, and backup safety. This contract does not require immediate schema implementation.

## 5. Repeating Rhythm Instance Model

Definitions:

- Library rhythm template: the reusable rhythm definition stored in Library.
- Enabled repeating rhythm: a user-approved template that may produce future suggestions.
- Generated rhythm instance: one concrete suggested occurrence from an enabled rhythm.
- Rhythm window: the useful period for one occurrence of a repeating rhythm.

Rules:

- There should be one current live instance per rhythm window.
- A skipped rhythm does not create backlog.
- The next useful occurrence is suggested later.
- Repeating rhythms do not create streak debt.
- Repeating rhythms do not track required adherence.
- Repeating rhythms do not create a backlog or catch-up pile.
- A rhythm instance should not appear in Today unless the user accepts it or a later contract explicitly approves another path.

## 6. Soft Window Finder Model

The soft window finder is not a hard scheduler.

Candidate window rules:

- Use Life Shape openCapacity blocks as default candidate windows.
- askFirst blocks may appear only as ask-first possibilities.
- protectedTime, recoveryTime, and familyTime blocks are unavailable by default.
- Blank time is not automatically available.
- Suggestions should be capped.
- Suggestions should be explainable.
- The app should not silently fill the day.
- The app does not need calendar integration to make first-version soft suggestions.
- The app does not need AI to make first-version soft suggestions.

The soft window finder can calculate options. It must not own placement.

## 7. User-Confirmed Placement Model

Soft placement is local.

Soft placement is not a calendar event.

Soft placement is removable.

The user confirms placement.

Placement does not imply failure if removed.

Placement does not hide the task until that time unless a later contract explicitly allows it.

Soft placement should be treated as a gentle local note: "this might fit here", not "this must happen here".

## 8. Re-Entry / Resurfacing Model

Missed, deferred, parked, and not today tasks are safely held.

They can return as calm suggestions when a plausible window exists.

They do not automatically stack into Today.

The user can:

- accept
- park safely
- mark not today
- bring back later
- mark no longer needed
- try the minimum version

Repeated resurfacing should be limited to avoid alert fatigue.

Re-entry should answer: "what still helps now?" rather than "what was not done?"

## 9. Deadline / Usefulness-Window Model

Future deadline and usefulness-window fields may include:

- fixedAt
- dueBy
- usefulUntil / notUsefulAfter
- latestUsefulStart
- minimumStillHelps
- noLongerNeeded

Rules:

- Deadlines are task properties, not soft placements.
- Soft placement is not a deadline.
- Tasks that cannot wait forever should become more visible before the useful window closes.
- If the original window has passed, the app should ask what still helps.
- Minimum may remain useful after the larger version is no longer useful.
- Language must remain calm.
- Do not use overdue, late, failed, urgent, or behind framing.

## 10. Automatic Versus User-Confirmed Behaviour

The app may automatically:

- store captured tasks
- calculate candidate windows
- calculate deadline or usefulness salience
- surface soft suggestions
- hold deferred tasks
- bring tasks back as suggestions

The user must confirm:

- adding to Today
- accepting a soft placement
- marking done
- parking
- marking not today
- marking no longer needed
- changing a deadline or usefulness window
- accepting askFirst placement in future work

Default rule: automatic calculation is allowed; automatic commitment is not.

## 11. MVP / Non-AI Prototype Sequence

Recommended implementation order:

1. Soft scheduling loop contract.
2. Task pool schema and repository.
3. Capture ad hoc task into task pool.
4. Show task pool in Plan.
5. Soft window finder v1 from openCapacity blocks.
6. User-confirmed soft placement from task pool.
7. Repeating rhythm instance contract.
8. Repeating rhythm instance suggestions.
9. Re-entry resurfacing for parked, not today, and deferred tasks.
10. Deadline and usefulness salience.
11. Move/edit soft placement.
12. Backup support for task pool and rhythm instances.
13. Final non-AI prototype smoke QA.

This sequence keeps behaviour local, explainable, and user-confirmed before broader automation is considered.

## 12. Non-Goals

This contract explicitly excludes:

- hard scheduling
- calendar integration
- AI
- cloud sync
- notifications
- import/restore execution
- productivity scoring
- streaks
- required-adherence tracking
- public accountability
- clinical or medical claims

Any future work in these areas needs a separate contract before implementation.
