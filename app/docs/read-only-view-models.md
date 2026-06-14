# Read-only view models

This layer defines the bridge between future local app data and the React screens:

```text
stored/local data snapshot -> pure selectors -> screen view models
```

The selectors in `src/viewModels/selectors.ts` are intentionally read-only. They do not call Dexie, IndexedDB, localStorage, network APIs, migration code, or scheduler code. They accept an in-memory snapshot and return deterministic view models for Today, Plan, Library, Reset, and Setup.

## Why this exists

Life Rhythm is moving from mock screen data toward local-first storage. Before any write paths are connected, screens need a stable read shape that preserves the product rules:

- Today acts on tasks and keeps one next useful action visible.
- Plan shows broad shape, fixed commitments, flexible rhythms, and hidden edges without becoming a rigid calendar.
- Library contains reusable rhythms and keeps one-off Today tasks separate.
- Reset is a relief valve, not a failure report.
- Setup exposes user-facing preferences and future module placeholders without becoming an admin console.

## Current scope

The current view model layer includes:

- `types.ts`: snapshot and screen view model contracts.
- `fixtures.ts`: in-memory fixtures for empty, normal, overloaded, library, plan, and future-module states.
- `selectors.ts`: pure `build*ViewModel(snapshot, options)` functions.
- `viewModels.test.ts`: selector and guardrail tests.

The future module placeholders are present but inactive by default:

- Rhythm Food
- Rhythm Move
- Rhythm Learn
- Rhythm Sleep
- Rhythm Work
- Rhythm Home
- Rhythm Calm
- Rhythm Money
- Rhythm Goals / Quiet Goals

## Not connected yet

This layer does not connect persistence. It does not migrate legacy data, create task writes, schedule rhythms, create notifications, connect calendar data, or expose backend/account behavior.

When persistence is approved later, the first step should be to build a read-only snapshot from validated local data, then feed that snapshot into these selectors. Write paths should remain separate from the view model layer.
