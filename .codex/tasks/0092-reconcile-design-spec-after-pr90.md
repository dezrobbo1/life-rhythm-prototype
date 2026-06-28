# Codex task — Reconcile design spec after PR #90

Issue: #92

## Goal

Update the repo documentation so the current design spec accurately reflects the merged PR #90 state.

This is a docs-only task.

## Context

PR #90 already implemented:

- top-level Pool screen
- Task Pool UI moved out of Plan and into Pool/shared Pool panel
- primary bottom navigation changed to Today / Plan / Pool / Library
- Reset and Settings available as secondary shell actions
- visible Inbox wording removed from app UI
- Pool styling moved toward a Holding Tray / ledger-row surface

The current design spec still incorrectly lists first-class Pool screen and Today / Plan / Pool / Library navigation as not implemented. Fix that documentation drift.

## Before editing, read

- `app/docs/life-rhythm-current-design-spec.md`
- `app/docs/navigation-redesign-contract.md`
- `app/docs/object-grammar-spec.md`
- `app/docs/visual-design-direction-contract.md`
- `app/docs/research/research-to-mvp-map.md`

## Implementation scope

Update only Markdown documentation.

## Required changes

1. Change the implementation-state section so it reflects the repo after PR #90.
2. Move these items from “not implemented yet” to implemented:
   - first-class Pool screen
   - four-tab primary shell: Today / Plan / Pool / Library
   - Reset removed from primary bottom nav and available as secondary action
   - Setup/Settings removed from primary bottom nav and available as secondary action
   - Task Pool UI moved out of Plan into Pool/shared Pool panel
   - visible Inbox wording removed from app UI
3. Keep “Pool ledger-row / Holding Tray visual implementation” as partially implemented, not complete.
4. Keep broad card-soup / pill-chip reduction across Plan and other screens as still needing work.
5. Add PR #90 to the milestone snapshot.
6. Update the near-term roadmap so the next implementation priority becomes:
   - Pool Holding Tray visual refinement
   - Plan card/pill reduction
   - Today dominant-object refinement
   - then soft window finder v1
7. Update trial readiness language so it no longer says first-class Pool navigation is missing.
8. Keep cloud sync, scheduler writes, calendar writes, AI writes, analytics, notifications, task history/completion logs, import/restore execution, and backend work explicitly out of scope.

## Explicit non-goals

- no app behaviour changes
- no schema changes
- no persistence changes
- no visual CSS changes
- no component changes
- no scheduler changes
- no calendar changes
- no AI changes
- no sync/backend changes
- no notification changes
- no analytics
- no import/restore execution

## Acceptance criteria

- Only Markdown docs are changed.
- `app/docs/life-rhythm-current-design-spec.md` no longer contradicts PR #90.
- PR body says “docs only.”
- PR body lists no app behaviour/schema/persistence changes.
- Tests/build are optional because this is docs-only, but if run, report results.

## PR title suggestion

`docs: reconcile design spec after Pool navigation PR`

## Suggested Codex start prompt

Run the task in `.codex/tasks/0092-reconcile-design-spec-after-pr90.md`. Follow the acceptance criteria exactly. Open a PR when done.
