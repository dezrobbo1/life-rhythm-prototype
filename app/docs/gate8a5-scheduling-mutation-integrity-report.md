# Gate 8A5 — Scheduling Mutation Integrity + User Corrections V0 Report

Status: final Gate 8A5 implementation/review evidence for PR #164. Application source is validated; PR remains open and unmerged.

Verified starting `main`: `87e5923cf5fb15d9d6be7619bf9fc01f31355fc0` (merged PR #163).

Branch: `feat/gate8a5-scheduling-mutation-integrity`.

## User outcome

Gate 8A5 makes two linked guarantees:

1. scheduling-affecting canonical writes cannot silently leave an accepted private plan stale without durable repair attention; and
2. an individual automatic private placement can be corrected through explicit Move/Protect authority without mutating external calendar truth.

The product boundary remains: power underneath, calm on the surface.

## Mutation audit

The implementation mechanically inspected the current production write paths rather than assuming all existing repositories were unsafe.

| Production mutation class | Pre-8A5 state | 8A5 disposition |
| --- | --- | --- |
| Setup/Life Shape | dedicated settings repair attention already existed | retained |
| static calendar import/remove/buffers | dedicated calendar mutation coordinator already existed | retained |
| explicit preference create/edit/delete/reset | dedicated target-scoped preference repair already existed | retained |
| duration-control save/reset | stale-command safety existed, but accepted-plan repair attention was not atomic with control mutation | **fixed** with durable duration-learning repair attention in the same transaction |
| behaviour-history delete | deletion was recovery-generation fenced, but accepted duration-learning authority was not durably invalidated in the delete transaction | **fixed** by writing duration-learning repair attention atomically when trusted behaviour rows are deleted |
| Capture / Today creation / task definition | task-input repair attention already existed | retained |
| ordinary task lifecycle | canonical lifecycle changed before best-effort UI repair; exact rhythm occurrences had stronger repair integration than ordinary tasks | **fixed** by task-input repair attention in the lifecycle transaction; generated rhythm occurrences retain rhythm-instance repair authority |
| Add Held item to Today / No longer needed | canonical task/Pool changes were not uniformly marked in the same transaction | **fixed** |
| Pool defer / direct Pool status change | could alter scheduler eligibility without one common durable repair guarantee | **fixed** |
| manual soft-placement create/remove/status | canonical placement authority could change before later repair | **fixed** with task-input repair attention |
| rhythm configuration/state/generation/routing | Gate 8A2 rhythm repair attention already existed | retained |
| Reduced Day / return to normal | coordinated accepted-plan/day-mode mutation already existed | retained as derived scheduler authority |
| overrun/missed-start | direct rolling repair from current canonical input | retained |
| scheduler-plan persistence | canonical/calendar/history/recovery snapshots already guard stale commits | extended to include explicit duration-repair attention |
| factual history writes | normally descriptive only | no new marker unless the history change can alter duration scheduling authority |

Compatibility-only repositories that are not current production scheduling mutation entry points were not rewritten merely for uniformity.

## Confirmed integrity gaps corrected

### Duration controls

Gate 7E duration controls were already stale-edit safe, but the control write itself did not durably mark an existing accepted plan for repair.

Gate 8A5 adds `durationLearningRepairPendingAt` to scheduler-plan state.

A control upsert/delete now:

- runs with the accepted scheduler-plan store in the same guarded transaction;
- persists the control;
- marks duration-learning repair attention;
- rolls back the control write if the marker cannot be persisted.

`ensureCurrentPrivatePlan` consumes this marker through the existing duration-learning repair path.

### Behaviour-history deletion

Trusted behaviour deletion can remove evidence that previously affected a Normal duration reservation.

The delete transaction now includes scheduler-plan state and sets duration-learning repair attention when behaviour rows were actually removed.

The user-owned deletion remains committed only if that durable repair attention can also be stored.

### Task / Pool / manual placement lifecycle

The following paths now write task-input repair attention in the same transaction as canonical state:

- ordinary active-task lifecycle;
- Bring to Today;
- No longer needed;
- Pool defer;
- direct Pool status update;
- Task Pool soft-placement create/remove;
- generic soft-placement create/status update.

Generated rhythm occurrence lifecycle continues to mark the exact rhythm instance instead of being flattened into an ordinary intention.

## Move authority

Move is implemented by `placementCorrectionCoordinator.ts`.

An exact rendered automatic placement is required.

Before commit, the coordinator verifies:

- recovery generation;
- exact accepted placement identity/coordinate/form;
- canonical scheduling-input snapshot;
- calendar source snapshot;
- non-past local time;
- current candidate scheduling authority;
- scheduler hard validation at the requested coordinate.

A successful Move stores a durable user-confirmed correction in `softPlacements`.

The record uses the existing canonical placement class plus optional correction metadata. No database-version bump is required.

The accepted scheduler plan then repairs around this correction.

A factual `userPlacementMoved` event is emitted only when coordinates actually changed.

## Protect authority

Protect uses the same canonical correction class but records protection explicitly.

Ordinary rolling repair therefore sees the protected placement as user-confirmed canonical placement authority, not merely as transient `pinnedPlacementIds`.

When harder reality later invalidates the coordinate:

- the protected placement is rejected;
- the target is not silently relocated to another automatic time;
- the protection record remains for explicit user correction;
- Plan surfaces the conflict as **Saved private time needs a new choice** using user-facing reason categories rather than raw scheduler IDs;
- Move remains available from the conflict surface, and Unprotect is available where it can be applied safely.

For an already-routed rhythm occurrence whose protected coordinate is invalid, V0 may require Move to a valid coordinate before protection can be removed. This avoids breaking the occurrence/Today link or inventing a replacement coordinate.

Unprotect removes the protection layer:

- a moved-and-protected correction remains a Move;
- a protection-only correction returns to scheduler-owned placement authority.

Terminal lifecycle transitions close/remove linked correction placements so completed/skipped/parked/not-today work does not stay live merely because it had been protected.

## Rhythm occurrence corrections

A correction for a generated rhythm occurrence retains complete identity:

- template;
- plan;
- recurrence revision;
- concrete instance.

One occurrence can be moved/protected without rewriting recurrence or future quota.

The linked `RhythmInstance.placementId` follows the durable correction ID.

Portable-profile validation distinguishes that canonical user correction from the Gate 8A4 scheduler-only routed-placement adjunct, preventing duplicate placement authority.

## Portable recovery

No portable format-version bump is required.

Existing valid Gate 8A4 portable-v1 backups remain readable because the new soft-placement correction fields are optional.

New backups retain Move/Protect state.

A live rhythm correction is stored once as canonical `softPlacements` authority and is excluded from `routedRhythmPlacements`.

After restore, normal plan rebuilding projects the correction into the accepted private plan; full `schedulerPlanState` remains excluded.

## Why this time?

The existing deterministic `placementReasonLines(...)` path remains the only placement explanation mechanism.

Gate 8A5 adds translation for factual correction provenance:

- user explicitly moved this placement;
- user explicitly protected this placement.

No LLM explanation, hidden solver metadata or psychological inference was added.

## Undo boundary

Gate 8A5 preserves the existing one-step scheduler Undo mechanism only where the prior plan can still be valid under current canonical authority.

Settings/task/rhythm definition provenance continues to withhold unsafe plan-only Undo.

Preference and duration repair handling retains/reopens authority as required by the existing tests and repository policy.

Persistent Move/Protect actions deliberately do not offer plan-only Undo in V0 because restoring only derived scheduler state would leave canonical correction authority behind. The user instead Move/Protect/Unprotects the correction explicitly.

This avoids a half-undo.

## Recovery-generation concurrency

Move, Protect and Unprotect reject an old rendered command after another handle restores the namespace.

The correction is not automatically replayed against the restored profile.

The coordinator also rechecks accepted-plan/canonical/calendar snapshots before the canonical correction transaction commits.

## Behaviour semantics

Move records factual movement only.

Protect persists explicit correction authority but does not invent a learned preference or psychological reason.

Gate 8A6 remains responsible for stronger learning-evidence interpretation.

## Persistence / migration impact

Database version remains **v6**.

The existing `softPlacements` class is extended with optional correction/target fields rather than introducing a new table.

Scheduler-plan schema adds optional duration-learning repair attention.

## UI

Plan exposes compact correction controls for applicable placements:

- Move;
- Protect this time / Unprotect;
- Why this time?

Move uses labelled date/time form controls and explicit Save/Cancel.

No drag-only interaction or external calendar write was introduced.

## Validation

Validated application-source head:

`0308197cbb30cde8f76cfa350a4f0774a9a0dfe5`

The dedicated Gate 8A5 matrix passed in all three required timezones:

| Timezone | Focused matrix | Full suite |
| --- | --- | --- |
| UTC | 31 files / 484 tests | 110 files / 1,344 tests |
| Australia/Perth | 31 files / 484 tests | 110 files / 1,344 tests |
| Australia/Sydney | 31 files / 484 tests | 110 files / 1,344 tests |

For each timezone, the workflow also passed:

- `npm ci --ignore-scripts`;
- production `npm run build`;
- `git diff --check origin/main...HEAD`.

On that same application-source head:

- App CI #361 passed: 110 files / 1,344 tests and production build;
- App Preview #577 passed;
- Vercel reported READY.

The dedicated Gate 8A5 workflow is retained as manual `workflow_dispatch` evidence tooling after this gate so later ordinary `/app` PRs do not automatically pay three full timezone suites.

## Final bounded review

One bounded Gate 8A5 review was performed after implementation. It covered mutation-attention atomicity, stale-plan presentation, Move/Protect persistence, hard-feasibility handling, rhythm occurrence identity, deterministic explanation, Undo boundaries, portable recovery and recovery-generation concurrency.

That review found one material V0 presentation gap: a protected correction invalidated by later hard reality was preserved in `rejectedExistingPlacements` but had no explicit correction surface. The final source correction now surfaces that state in Plan, gives a calm reason and exposes Move/Unprotect actions without rendering internal placement/commitment IDs. A regression covers that path.

No material blocker remains in the bounded Gate 8A5 mechanism after that correction.

External automated review limitation: Codex review could not run because the account had reached its review usage limit. CodeRabbit manual review attempts made while the branch was still changing did not complete because the PR base/head changed. There are zero unresolved review threads. These unavailable external reviews are recorded rather than represented as passed.

## Manual UI status

The deployed Vercel preview is READY, but normal manual deployed walkthrough remains unavailable where preview access requires sign-in. That authentication boundary was not bypassed.

Automated UI tests cover keyboard-operable native buttons, labelled Move date/time inputs, explicit Save/Cancel, deterministic Why-this-time disclosure and the protected-conflict correction surface.

Issue #160 remains open for Gate 8A8 narrow/mobile actual-device acceptance.

## Deferred

Not part of Gate 8A5:

- completion-variant evidence semantics (8A6);
- broad UI/navigation/copy convergence (8A7);
- final personal-trial acceptance (8A8);
- Gate 8B longitudinal trial;
- AI scheduling/explanation;
- external calendar writes;
- learnt preferences inferred from Move/Protect.

## Gate status

- 8A1 COMPLETE
- 8A2 COMPLETE
- 8A3 COMPLETE
- 8A4 COMPLETE — PR #163 merged
- 8A5 IMPLEMENTED / REVIEWED — PR #164 pending merge
- 8A6 NOT STARTED
- 8A7 NOT STARTED
- 8A8 NOT STARTED
- 8B NOT STARTED
