---
name: final-merge-gate
description: Use when deciding whether a completed Life Rhythm PR may merge, after review and any confirmed-blocker corrections.
---

# Final merge gate

1. Read [AGENTS.md](../../../AGENTS.md), the contract, [MVP_PLAN.md](../../../MVP_PLAN.md), review dispositions and [human gates](../../../docs/HUMAN_GATES.md). Verify live main/base and exact PR head through the plugin; local validated source must correspond. Changed source invalidates affected evidence.
2. Verify required tests/build/checks for that head, milestone acceptance, no unresolved **Block before merge** findings and no pending required human acceptance/authorization. Inspect available CI/review results; never infer physical/user acceptance from automation. Record safely deferred follow-ups. P0/P1/P2 alone is not the merge rule.
3. Report BLOCK when gates fail and correct authorized engineering blockers. Report PRODUCT OWNER DECISION REQUIRED or MANUAL ACTION REQUIRED for applicable human dependencies. If draft-only/no-merge or another task restriction applies, stop at the decision and leave the PR unmerged.
4. Only when permitted and every gate passes, use plugin merge with the verified expected head SHA. Confirm merge/live main. Update [CURRENT_STATE.md](../../../CURRENT_STATE.md) via a focused documentation change with verified main, scope, next approved slice, blockers/acceptance, PR and date. Update MVP_PLAN.md if programme/readiness changes. Never promote a prepared protocol to readiness PASS.

Respect AGENTS.md's stopping rule. Determine the next approved slice using plan-next-milestone; stop at the approved MVP boundary. Markdown does not launch further tasks.
