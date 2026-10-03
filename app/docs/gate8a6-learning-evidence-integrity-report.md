# Gate 8A6 — Learning Evidence Integrity Report

Status: implemented and reviewed in PR #165 on `feat/gate8a6-learning-evidence-integrity`; pending merge.

Verified starting `main`: `e6bd22fde856ea191fd59bdfc0103d2871513ee3` (merged PR #164).

## Reproduced gap

Before editing, Today routed Mark normal done, Mark full done and Stop here through the same `done` transition, which wrote a `taskCompleted` fact without the chosen form. Gate 7E accepted every positive template-linked completion as Normal evidence and excluded all generated rhythm occurrences. Red regressions demonstrated that the schema rejected the new factual field and the lifecycle writer lost explicit completion intent.

## Implemented boundary

The version 1 behaviour-event schema accepts an optional `completedVariantKind` only for `taskCompleted`. Today sends `normal`, `full` or `unspecified`; generic repository calls use `unspecified`. Legacy rows remain valid and unknown. Minimum Done stays an independent fact. Active elapsed minutes, exact template/instance provenance, atomic lifecycle writes and recovery fencing remain intact.

Gate 7E selects only valid positive explicit Normal completions for template-scoped Normal duration, including generated rhythm occurrences. Gate 7B continues to describe valid completion durations regardless of variant. The existing accepted-plan reconciliation detects a formerly learned duration whose old evidence is now ineligible and restores saved Normal or explicit override authority without rewriting canonical task/template records.

Duration Learning and Why-this-time wording now names trusted Normal completions. No preference, Full/Minimum duration adaptation, AI, database or portable format migration was added. Database version remains 6 and portable profile remains version 1.

## Verification and review

Focused regression coverage includes event validation, Today action intent, planned versus completed form, active timing across Pause/Minimum/Continue, generated rhythm identity, Normal-only learning, descriptive statistics, behaviour-history deletion, portable round trip and accepted-plan fallback from legacy evidence.

Final local source-tree validation:

| Timezone | Focused matrix | Complete suite |
| --- | --- | --- |
| UTC | 14 files / 289 tests passed | 110 files / 1,362 tests passed |
| Australia/Perth | 14 files / 289 tests passed | 110 files / 1,362 tests passed |
| Australia/Sydney | 14 files / 289 tests passed | Not required |

`npm run build` and `git diff --check` passed. The build emitted its existing large-chunk advisory. The bounded implementation review found ambiguous remaining Duration Learning copy and missing direct deletion evidence; both were corrected in one pass. CodeRabbit's single review identified two confirmed narrow compatibility/copy defects: older persisted learned-duration provenance lost its explanation and a Full-only history produced a misleading empty state. Red regressions reproduced both; the consolidated correction preserves the old explanation without claiming Normal-only evidence and describes the absence of eligible Normal samples. The final matrix above and build passed after the correction. Hosted check status is recorded in the PR and final handover. The hosted preview redirects to Vercel sign-in; no unauthenticated manual Today walkthrough was possible.

Gate 8A7, Gate 8A8 and Gate 8B have not started. Issue #160 remains the Gate 8A8 narrow/mobile acceptance follow-up.
