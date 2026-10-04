# Gate 8A8 — Prepared Evidence Protocol and Blocked Readiness Record

**Decision: GATE 8A8 — BLOCK. Gate 8B has not started.** This is a preparation document, not final Gate 8A8 acceptance. Merging it does not authorize a baseline or Day 1.

Authority baseline: `main` at `e57f900ae2d344e60247b468b74ad5e25e842197` (merged PR #169). `MVP_PLAN.md` is the delivery/readiness authority. Gate 8A7B is active; 8A7C and 8A7D remain required. The final 8A8 decision must be made later against an identified integrated, deployed build after those milestones exit. This document changes no executable behaviour.

## Evidence-source map for the future owner trial

Categories: **A** existing trusted factual application data; **B** bounded derivation from those facts; **C** sparse user report; **D** unavailable with sufficient integrity. A future account-backed replica must count each acknowledged event ID once, regardless of how many devices receive it. Occurrence time and local timezone remain distinct from server receipt/sync time. Preserve a checked start snapshot/cursor and exact trial interval; missing/deleted history makes affected results incomplete, not reconstructed. No content analytics or new instrumentation is authorized here.

| Outcome | Category | Defensible source and limit |
| --- | --- | --- |
| Planning/replanning minutes | C | Prospective numeric seven-day baseline and numeric report for each exact seven-day use window; at least three numeric use reports for comparison. Optional ranges do not enter the calculation. |
| Recorded manual placement/Undo subset | B | Unique trusted `userPlacementCreated/Moved/Removed` and `schedulerRepairUndone` events inside the trial cursor/window. This is not every manual action. |
| Forgotten important intention | C | Optional short incident; an uncaptured intention is not inferable from app state. |
| Invalid/conflicting placement | B | Current hard/protected validation and observed incidents; not a complete historical conflict rate. |
| General override/correction/Undo rate | D | No matched opportunity denominator. Report bounded event counts only, not a general percentage. |
| Initiation latency | D | A durable unambiguous planned-start-as-seen pairing is not available across repairs. |
| Disruption recovery effort, Reduced Day/re-entry burden | C | Short report when naturally encountered; events do not measure felt effort. |
| Unnecessary visible churn and interaction burden | C | Short report; factual scheduler moves do not establish visibility or necessity. |
| Trust and autonomy/control | C | Same anchored 1–5 questions at baseline and each use window, with higher meaning better. |
| Continued voluntary use | C | Explicit per-window and end-of-period report; missing reporting does not prove continued use. |
| Causal benefit of learned Normal duration | D | Eligible samples and reservation provenance are diagnostics, not a counterfactual benefit claim. |
| Task completion, secondary | A | Unique trusted `taskCompleted` facts with explicit variant; legacy/Stop unknown remains unknown. |

## Historical automated preparation, not final acceptance

The previous controlled fake-IndexedDB 24-file cross-layer matrix passed **471 tests in UTC and 471 in Australia/Perth** against the PR #166 executable tree, `0f6ba19ad48b39d514d13e82e9fb80aee4434196`. That tree also passed the existing **110-file/1,370-test** UTC and Perth suites and a production build. These results cover the then-current task truth, rhythms, static ICS/day setup, scheduler/repair, Today, Reduced Day/re-entry, learning facts and local portable recovery. The earlier identified Vercel production deployment at that SHA was READY, but the cloud browser reached a sign-in wall; no app walkthrough was observed in that attempt. Its URL/READY state does not identify the owner's separate mobile recording or establish deployed acceptance. This historical evidence does **not** exercise future calm/mobile convergence, account persistence/sync, a live provider, or their integrated deployed behaviour. Source validation must be renewed for the changed executable tree at final 8A8; no application suite was rerun for this documentation PR.

## Remaining prerequisites and future acceptance rows

Every applicable row must be Pass on an identified integrated build. All rows below are **Pending / BLOCK**, except the separately attributed partial mobile FAIL. A prepared test or tracked defect is not a product PASS.

| Gate / row | Future human acceptance and automated boundary | Current result |
| --- | --- | --- |
| 8A7B / #168 calm surface | Actual portrait mobile with keyboard and zoom, desktop and keyboard-only focus/activation/Escape/return; reachable Capture save/reload; quiet Library/Settings/recovery; populated Today Now/Later/Changed, Plan correction/relief. Focused interaction tests preserve authored minutes, occurrence identity and repair safety. | **Partial performed FAIL** on recorded mobile paths; remaining rows unperformed/unattributed. |
| 8A7C account state | Restricted sign-in and verified account ownership; acknowledged save survives browser clear and clean second supported browser/device; local/offline queued writes, reconnect/conflict preservation, account switch isolation, delete/reset fencing and previewed/confirmed legacy migration. Normal continuity uses the account; export is independent fallback. Negative isolation, idempotency, revision, migration and resurrection tests. | Pending; no account-data backend exists in the historical executable tree. |
| 8A7D live calendar | Connect one supported real read-only provider; initial and automatic refreshed reads; stable provider event/series/occurrence identity; updates, deletion and recurrence exceptions trigger safe private-plan repair. Demonstrate last refresh, stale/offline/revoked/reconnect states and no external writes. Provider/token/cursor/recurrence/timezone tests. Static ICS stays a snapshot fallback. | Pending; historical ICS import is not a live connection. |
| Integrated 8A8 product | Stable authenticated origin; exact frontend SHA, backend/API deployment, schema/protocol and relevant configuration versions; supported device/browser/timezone/provider population. Task/rhythm authoring/execution, seven-day setup, scheduler corrections/Why/Undo, Today/Changed, Reduced Day/re-entry, learning facts, account continuity, calendar freshness/repair, export/delete/recovery fallback and calm mobile/desktop/keyboard use. Safe throwaway recovery, required source checks and explicit human results. | **BLOCK** until B/C/D exit and every applicable deployed row passes. |

For destructive restore/deletion, use disposable state and an independent safe copy, never the owner's only durable account copy. An accepted Perth-only fixed-timezone owner population does not resolve #146 for internal DST-transition placement times.

## Mobile evidence and issue disposition

The owner-provided 3 October deployed-preview recording is **partial performed acceptance with observed FAIL**, not an unperformed walkthrough. It shows Capture keyboard/zoom clipping and horizontal panning, Settings-side clipping/panning, repeated Library card burden and substantial ordinary-use configuration/recovery machinery. The recording does not independently establish an exact deployed SHA or exercise every #160 row; its observed paths fail and the unexercised rows remain unproven. Issue #168 owns the 8A7B product-convergence blocker. Issue #160 remains open for exact build attribution, outstanding mobile/desktop/keyboard rows and blocker dispositions; it may ultimately close with a documented FAIL without changing Gate 8A8 readiness.

Issue #141 was **closed** by merged PR #169. Issue #146 remains **open** for supported internal DST-transition populations, not an explicitly Perth-only fixed-timezone owner trial. Issues #160 and #168 remain **open**. No issue is closed by this preparation document.

## Final acceptance boundary

Only a future integrated Gate 8A8 record may change BLOCK to PASS, with build/configuration, accepted population, owner-run evidence and all blocker dispositions. PR #167's documentation merge cannot do so. The prospective baseline and Day 1 in [`gate8b-personal-trial-protocol.md`](gate8b-personal-trial-protocol.md) remain prohibited until that explicit PASS. Historical PR #104 trial files remain reference material.
