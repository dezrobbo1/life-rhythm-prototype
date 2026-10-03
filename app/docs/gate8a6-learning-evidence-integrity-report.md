# Gate 8A6 — Learning Evidence Integrity Report

Status: implemented and corrected after Codex review in PR #165 on `feat/gate8a6-learning-evidence-integrity`; pending final hosted checks and merge decision. PR remains unmerged.

Verified starting `main`: `e6bd22fde856ea191fd59bdfc0103d2871513ee3` (merged PR #164).

## Reproduced gap

Before editing, Today routed Mark normal done, Mark full done and Stop here through the same `done` transition, which wrote a `taskCompleted` fact without the chosen form. Gate 7E accepted every positive template-linked completion as Normal evidence and excluded all generated rhythm occurrences. Red regressions demonstrated that the schema rejected the new factual field and the lifecycle writer lost explicit completion intent.

## Implemented boundary

The version 1 behaviour-event schema accepts an optional `completedVariantKind` only for `taskCompleted`. Today sends `normal`, `full` or `unspecified`; generic repository calls use `unspecified`. Legacy rows remain valid and unknown. Minimum Done stays an independent fact. Active elapsed minutes, exact template/instance provenance, atomic lifecycle writes and recovery fencing remain intact.

Gate 7E selects only valid positive explicit Normal completions for template-scoped Normal duration, including generated rhythm occurrences. Gate 7B continues to describe valid completion durations regardless of variant. The existing accepted-plan reconciliation detects a formerly learned duration whose old evidence is now ineligible and restores saved Normal or explicit override authority without rewriting canonical task/template records.

Codex reviewed head `a8a7615f3777ead460945ebed7a76d08f06e994a` after the prior handover. Its three P1 findings were independently reproduced or source-traced and classified **Block before merge**. The prior claim that no Codex review was observed, and its MERGE WITH FOLLOW-UPS verdict, are superseded. The consolidated correction:

1. Guards a rendered Today task's actions synchronously across completion, Park, Not today and progress writes. Competing terminal commands cannot reach persistence or replace feedback while the first is pending; failure releases the guard. A deferred-write regression and an actual lifecycle idempotence regression preserve the first Normal fact.
2. Compares an accepted plan's stored duration-learning authority with current evidence on the ordinary Today read. A mismatch invokes existing deterministic repair before automatic placements appear, reloads and rechecks the accepted authority, and hides the stale plan if reconciliation fails. A real database upgrade test proves legacy completions stay unchanged while saved Normal or an explicit override replaces the old learned placement.
3. Applies template-scoped learned or override Normal minutes to the projected scheduler variant of a concrete RhythmInstance. Its saved Normal, Minimum, Full, recurrence and identity remain intact; placement duration and Why-this-time provenance reflect the projected authority.

Duration Learning and Why-this-time wording now names trusted Normal completions. No preference, Full/Minimum duration adaptation, AI, database or portable format migration was added. Database version remains 6 and portable profile remains version 1.

## Verification and review

Focused regression coverage includes event validation, Today action intent, planned versus completed form, active timing across Pause/Minimum/Continue, generated rhythm identity, Normal-only learning, descriptive statistics, behaviour-history deletion, portable round trip and accepted-plan fallback from legacy evidence.

Final local source-tree validation:

| Timezone | Focused matrix | Complete suite |
| --- | --- | --- |
| UTC | 17 files / 353 tests passed | 110 files / 1,370 tests passed |
| Australia/Perth | 17 files / 353 tests passed | 110 files / 1,370 tests passed |
| Australia/Sydney | 17 files / 353 tests passed | Not required |

The earlier bounded implementation and CodeRabbit review corrections remain covered. The final matrix above passed after the Codex correction; `npm run build`, `git diff --check` and final hosted checks are recorded in the PR and handover. The previous preview redirected to Vercel sign-in; the final-head manual result must be reported separately and must not be presumed passed.

Gate 8A7, Gate 8A8 and Gate 8B have not started. Issue #160 remains the Gate 8A8 narrow/mobile acceptance follow-up.
