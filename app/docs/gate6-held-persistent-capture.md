# Gate 6E1 — Held and persistent Capture

Gate 6E1 makes the existing Task Pool persistence feel like the user-facing concept **Held**: things Life Rhythm is safely remembering without making them immediate demands. Internal `taskPoolItems` tables, schemas, repository names, lifecycle statuses, and backup formats remain unchanged.

## Persistent Capture authority

The application shell exposes Capture from Today, Plan, Held, and Library without adding another navigation destination. Shell Capture and Held-local Capture use the same validated coordinator and the existing modal fields and defaults.

Before writing, the coordinator performs a truthful Task Pool collection read. A total read failure blocks the write and reports that nothing was captured. A partial read permits a single keyed append because that operation does not replace, delete, or repair unreadable rows. Successful capture creates exactly one `captured` Task Pool item and does not create an active Today task, soft placement, scheduler plan, calendar event, or Library rhythm.

Capture closes after success, leaves the current screen selected, and refreshes a mounted Held surface. The existing request/write generation guards continue to prevent stale Held reads from replacing newer visible state.

## Preserved Held capabilities

Held retains the existing persisted grouping and lifecycle capabilities:

- captured, parked, Not today, deferred/bring-back-later, ready-to-revisit, suggested, and softly placed groups;
- Add or Bring to Today through the linked lifecycle transaction;
- Plan handoff without calendar creation;
- explicit No longer needed;
- truthful loading, empty, partial-invalid, read-failure, and read-only Retry states;
- Task Pool backup export/check under the user-facing Held wording.

Held is not a backlog, priority queue, overdue ledger, or catch-up debt surface.

## Boundaries

This slice does not merge Library with Held, persist Library enablement, change recurrence or scheduling, add a database migration, alter external calendar authority, redesign Today or Plan, remove Library navigation, or perform the final Gate 6E2 navigation/surface cutover.
