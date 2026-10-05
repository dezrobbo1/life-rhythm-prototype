---
name: resolve-review
description: Use when a Life Rhythm PR has confirmed review blockers or required P1/P2 corrections after its substantive review.
---

# Resolve review

1. Read [AGENTS.md](../../../AGENTS.md)'s review disposition and stopping rules, the contract, exact reviewed head and findings. Confirm each supported failure path; severity alone is not a correction mandate.
2. Correct confirmed **Block before merge** findings, including P1/P2 where required, in one consolidated pass within milestone scope. Record safely deferred bounded findings with consequence/revisit condition; exclude unsupported or unrelated concerns with evidence.
3. Rerun affected validation and required final checks for changed source. Reuse unchanged valid evidence. Follow [access workflow](../../../docs/CODEX_WORKFLOW.md) before publishing/updating the same PR; report new head and finding dispositions.
4. Do not restart broad review without a genuinely new material blocker, materially changed risk-bearing design or owner requirement. Cluster repeated failures into one bounded mechanism matrix and stop after confirmed corrections/verification.

Use [human gates](../../../docs/HUMAN_GATES.md) for unavailable human action or product decision, not routine engineering difficulty. Hand off to final-merge-gate with exact evidence; do not weaken tests to close findings.
