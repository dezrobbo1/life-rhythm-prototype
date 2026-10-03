# Gate 8A6 — Learning Evidence Integrity Contract

## Factual completion evidence

The Gate 7A `behaviourEvent` ledger remains canonical. `taskCompleted` version 1 now permits optional `completedVariantKind: normal | full | unspecified`. This field describes the explicit completion endpoint, not the scheduler's `plannedVariantKind` or the task's elapsed duration. It is forbidden on other event types. Existing completion rows without the field retain an unknown variant and are neither changed nor backfilled.

| User or repository action | Persisted completion evidence | Normal-duration sample? |
| --- | --- | --- |
| Mark normal done | `normal` | Only with exact template ID and positive observed active minutes |
| Mark full done | `full` | No |
| Stop here | `unspecified` | No |
| Generic/legacy repository transition to `done` | `unspecified` | No |
| Older valid completion row lacking the field | absent, meaning unknown | No |
| Minimum Done | separate `taskMinimumAchieved` event | No |

Minimum followed by Stop preserves the Minimum milestone without claiming an exact Minimum completion duration. A task planned as Minimum, Normal or Full does not establish the completed form. The Today action supplies the narrow typed completion intent through the active-task/lifecycle write boundary into the behaviour event. ActiveTask, Pool, soft-placement and RhythmInstance lifecycle states stay as before. The behaviour append remains inside the same guarded transaction as lifecycle, linkage and repair-attention writes; its failure rolls back the transition. Recovery-generation fencing and append-only duplicate-ID rules remain in force.

Today admits only one current-task write at a time, synchronously guarding the command before awaiting persistence and disabling competing completion, Park, Not today and progress actions while it is pending. Feedback for a terminal choice follows its successful write; a rejected or stale write releases the guard for a safe retry.

## Duration evidence and user authority

Gate 7E accepts only schema-valid, positive-duration, template-linked `taskCompleted` events with explicit `completedVariantKind: normal`. A generated rhythm occurrence is eligible on the same terms and retains its exact `templateId` and `rhythmInstanceId`. Full, Stop/unspecified, legacy unknown, Minimum-achieved, malformed and non-positive observations cannot adapt the Normal reservation. The deterministic upper-quartile policy and three-sample threshold are unchanged.

Gate 7B may still describe any valid completion's observed duration, including legacy and Full, because it reports observed completion durations rather than Normal-specific duration. A partial or failed ledger still pauses inferred adaptation. Explicit disable uses the saved Normal duration; an explicit positive user override applies even with no eligible samples. Reset restores eligibility under current healthy evidence. A previously accepted learned estimate based only on older unknown events is reconciled through the existing duration-learning repair path to the saved Normal duration or explicit override. No task or template definition is rewritten.

The ordinary Today plan read compares accepted duration-learning authority with current healthy evidence before presenting automatic placements. A mismatch invokes the existing deterministic plan repair, reloads the accepted state and checks its current authority. A failed or still-incoherent repair does not present the stale plan. For a concrete generated RhythmInstance, the projected scheduler Normal variant receives template-scoped learned or override minutes and provenance with the instance's saved Normal minutes; Minimum, Full and the durable instance snapshot remain unchanged.

## Persistence and portability

The optional event field is validated by the existing v1 event schema and carried unchanged by portable profile v1 export/check/restore. Existing backups remain readable. Database version stays 6; there is no table, index, migration, new ledger, or completionLog activation. Behaviour-history deletion removes these facts and their derived learning authority through the existing atomic repair marker.

Gate 8A7 UI convergence, Gate 8A8 trial acceptance and Gate 8B remain separate milestones. Completion choices are execution facts, not inferred preferences or psychological explanations.
