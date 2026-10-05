---
name: implement-milestone
description: Use when implementing one approved Life Rhythm milestone with an explicit bounded contract, after planning and before PR review.
---

# Implement milestone

1. Read [AGENTS.md](../../../AGENTS.md), its ordered authorities and the approved contract. Verify live main, local HEAD/source/status and active PRs under [CODEX_WORKFLOW](../../../docs/CODEX_WORKFLOW.md). Reconcile safely; stop with STALE WORKSPACE BLOCKER if impossible.
2. Create a focused branch from verified current main, or verify the existing PR branch for an authorized continuation. Implement only this slice; preserve unrelated edits, invariants, migration/backup coherence and non-goals.
3. Run AGENTS.md's required tests/builds and relevant timezone checks; docs-only work uses path/link/status validation and diff whitespace checks. Record unavailable required human evidence under [HUMAN_GATES](../../../docs/HUMAN_GATES.md).
4. Reverify live base/head before publishing intended tested source through plugin commit/ref actions. Open/update one PR with contract, changes, exact head, validation and remaining acceptance. Do not broaden scope or merge as part of this implementation step; final-merge-gate owns that decision.

Use [model policy](../../../docs/CODEX_MODEL_POLICY.md); output PR/head, evidence and blocker dispositions.
