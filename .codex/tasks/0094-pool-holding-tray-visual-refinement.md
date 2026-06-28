# Codex task — Align Pool with Holding Tray visual reference

Issue: #94

## Goal

Refine the Pool surface so it feels like a calm Holding Tray / Soft Ledger surface, not a generic task list or dashboard.

This is a narrow UI/object-grammar refinement task.

## Context

The app already has:

- Task Pool schema and repository
- top-level Pool screen
- Today / Plan / Pool / Library primary nav
- Reset and Settings as secondary shell actions
- task capture in the Pool/shared Pool panel
- no-longer-needed action
- design spec reconciled after PR #90 and PR #93

Pool is structurally present, but it still needs stronger Holding Tray object grammar.

## Before coding, read

- `app/docs/life-rhythm-current-design-spec.md`
- `app/docs/visual-design-direction-contract.md`
- `app/docs/navigation-redesign-contract.md`
- `app/docs/object-grammar-spec.md`
- `app/docs/theme-system-contract.md`
- `app/docs/research/research-to-mvp-map.md`
- `app/src/screens/PoolScreen.tsx`
- `app/src/features/taskPool/TaskPoolPanel.tsx`
- `app/src/features/taskPool/TaskPoolCaptureModal.tsx`
- `app/src/styles/global.css`
- relevant tests for Pool / App shell / task pool, if present

## Implementation scope

Refine only the Pool screen / Task Pool panel UI and CSS. Reuse existing data, statuses, repository functions, and capture/no-longer-needed behaviour.

## Required UI changes

1. Group visible task pool items by state/status into calm Holding Tray sections. Suggested groups:
   - Captured / Safely held
   - Parked
   - Bring back later / Deferred
   - Not today
   - Suggested / Softly placed, only if existing statuses require display
2. Render each group as a quiet Holding Tray section:
   - small section label
   - subtle left state rule or marker
   - ledger rows
   - no red states
   - no counters
   - no dashboard framing
3. Preserve or improve safe-holding copy:
   - use Pool / Task Pool / Holding Tray language
   - use calm language such as “Safely held”, “Held out of Today”, “Bring back when useful”, “No schedule created”
   - do not use Inbox, backlog, queue, overdue, catch up, or pending-total language
4. Reduce card-like treatment around the Pool panel:
   - avoid heavy rounded card container
   - avoid shadowed panel treatment
   - avoid boxed-everything layout
   - use rules, rows, spacing, and subtle tray surfaces instead
5. Reduce pill-chip metadata. Prefer plain metadata lines.
6. Keep the Capture task action. It should remain visible, but visually quiet and aligned with the ledger/tray surface.
7. Keep No longer needed available. It should not make every row feel like a control panel.
8. Preserve the empty state: capturing something here must not add it to Today.
9. Keep accessibility reasonable:
   - semantic headings for groups
   - buttons remain keyboard accessible
   - status/feedback remains readable by assistive technology
10. Update or add tests only where existing tests expect old labels/structure.

## Do not change

- task pool schema
- Dexie table
- repository function signatures
- persistence behaviour
- task statuses
- Today behaviour
- Plan behaviour, except import cleanup if required
- soft placement logic
- scheduler logic
- calendar logic
- AI
- auth
- sync/backend
- analytics
- notifications
- task history/completion logs
- import/restore execution
- backup behaviour

## Acceptance criteria

- Pool groups visible task pool items by current status/state.
- Pool reads as a Holding Tray / ledger-row surface, not a generic card list.
- Pool does not use Inbox wording.
- Pool does not show dashboard-style counts, urgency states, progress metrics, or backlog framing.
- Capture task still works.
- No longer needed still works.
- Empty state still clearly says capture does not add to Today.
- No schema, db, repository, persistence, scheduler, calendar, AI, auth, sync/backend, analytics, notifications, task-history, import/restore, or backup changes.
- Existing tests pass.
- `npm test` passes from `app/`.
- `npm run build` passes from `app/`.
- PR body states: UI/object-grammar refinement only.
- PR body confirms no scheduler/calendar/AI/sync/analytics/notification/import/restore changes.

## PR title suggestion

`refactor: align Pool with Holding Tray object grammar`

## Suggested Codex start prompt

Run the task in `.codex/tasks/0094-pool-holding-tray-visual-refinement.md`. Follow the acceptance criteria exactly. Open a PR when done.
