# Life Rhythm `/app`

Status: Current React/Vite/TypeScript implementation path for the adaptive MVP

The root 1.4.6 GitHub Pages PWA remains a protected legacy runtime. New product work targets `/app` unless a task explicitly says otherwise.

Read first:

- [`../PRODUCT.md`](../PRODUCT.md)
- [`../MVP_PLAN.md`](../MVP_PLAN.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../docs/RESEARCH_BASIS.md`](../docs/RESEARCH_BASIS.md)
- [`../docs/DOCUMENTATION_AUTHORITY.md`](../docs/DOCUMENTATION_AUTHORITY.md)

## Current implementation baseline

Historical reset baseline: merged PR #112 (e0c1d175e9082f7e5bdc5f1aeae6980146e4994b). Current verified main: 0f6ba19ad48b39d514d13e82e9fb80aee4434196 (merged PR #166).

Current /app implements automatic private scheduling and repair, configured flexible rhythms, Now/Later/Changed, user corrections, Reduced Day/re-entry, factual/bounded learning and portable whole-profile recovery. Personal application data are currently browser-local; optional Clerk identity selects a local profile and does not provide account-backed continuity. Calendar support is currently a static read-only ICS snapshot. Owner-trial readiness remains BLOCK pending the remaining milestones in MVP_PLAN.md. The legacy root and historical PR #112 snapshot are not current /app runtime authority.

## Current implementation limitations

These are implementation facts, not product prohibitions.

The owner-trial product still requires whole-product calm/mobile convergence, authenticated account-backed durability with safe local replica/reconnect behaviour, one automatically refreshed live read-only calendar connection, and integrated deployed acceptance. AI, calendar writes, public signup, broad provider coverage and simultaneous automatic multi-device merging remain deferred.

## Current next gate

See ../MVP_PLAN.md.

The active implementation milestone is:

> Gate 8A7B — Whole-product calm-surface convergence.

Do not begin Gate 8B until revised Gate 8A8 records an integrated PASS.

## Architectural transition

The current scheduler, lifecycle, recurrence, learning and recovery foundations are reusable. Remaining pre-trial work should converge the ordinary surface, establish account-backed durability/local replication, add one live read-only calendar connection, then accept the integrated deployed product. ARCHITECTURE.md defines those target boundaries; implementation must preserve existing data-integrity and scheduling invariants.

## Product direction relevant to `/app`

The primary product question is:

> Does the app make fewer executive decisions necessary?

This means the existing four-tab shell, Holding Tray terminology, manual placement flow and visual object grammar can change when the MVP demonstrates a simpler interaction.

Retain good interaction/accessibility work where it serves the product.

## Commands

```bash
npm ci
npm run dev
npm test
npm run build
```

When date/time/scheduling/calendar/re-entry behaviour changes, run timezone-sensitive tests in both UTC and Australia/Perth where the environment permits.

The `/app` build is currently a preview artifact and is not the protected root GitHub Pages deployment source.
