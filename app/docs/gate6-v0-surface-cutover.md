# Gate 6E2 — v0 surface cutover

Gate 6E2 makes the truthful Day Line the default Plan product while retaining the current scheduler, persistence, calendar, Held handoff, and manual-placement authorities.

## Default Plan surface

Plan opens with the selected date and the read-only Day Line. Fixed commitments, protected and ask-first time, explicit possible space, scheduler-owned placements, and user-confirmed placements keep the Gate 6C truth boundary. Blank gaps are not capacity.

A concise **Changed** section and its supported one-step Undo remain visible when the latest accepted private-plan repair contains real changes. Empty Changed state is omitted. Material scheduler, manual-data, calendar-source read failures, and post-calendar-change repair failures remain visible outside the closed disclosure and are never described as a healthy empty plan. A saved calendar change whose private-plan repair fails remains explicitly visible until a later successful repair/recovery.

## Plan details

One native **Plan details** disclosure contains:

- automatic private-placement rows and provenance;
- Refresh flexible plan and planning notes;
- detailed Day Shape boundaries;
- Held soft suggestions and task-specific Plan handoff;
- add/remove controls for user-confirmed private placements;
- read-only calendar import, replacement, and removal.

The disclosure changes presentation only. `PersonalPlanScreen` stays mounted while it is closed, so the existing canonical `ensureCurrentPrivatePlan` lifecycle still runs on Plan mount. Opening or closing details does not build, repair, write, or reset plan state.

## Authority and isolation

Day Line reads remain read-only. The scheduler coordinator remains the only automatic-plan authority. Soft placements remain user-owned private records, and calendar imports remain read-only external context. Optional Held/manual read failures do not hide an otherwise readable Day Line or automatic plan.

Today, Held, persistent Capture, Library, Reduced Day, Minimum achievement, re-entry, recurrence, elapsed-time handling, and scheduler heuristics are unchanged.

## Explicit exclusions

This slice does not change navigation destinations, remove Library, merge task/rhythm storage, persist Library enablement, change database schemas or migrations, add calendar writes, redesign recurrence, introduce behavioural learning or AI, or alter scheduler feasibility/ranking.

The remaining Gate 6 work is end-to-end daily-loop acceptance and the Gate 6 exit check.
