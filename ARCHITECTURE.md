# Life Rhythm Architecture

Status: Current target architecture for the MVP path

## Architectural objective

Life Rhythm should become a local-first adaptive executive-function system whose scheduling decisions are reproducible, testable and reversible.

The target architecture is:

> structured life state + deterministic adaptive scheduling + simple behavioural learning + explicit provenance/confidence + optional AI interpretation + risk-calibrated action control

The architecture must make the surface simpler as the machinery underneath becomes stronger.

## High-level model

```text
                 Calm daily UI
          Now · Later · Changed · Undo
                       |
                       v
              Action / policy gate
        risk · authority · confidence
                       |
          +------------+------------+
          |                         |
          v                         v
 Deterministic scheduler      Optional AI adapter
 hard/soft constraints        natural language
 rhythms and task variants    task decomposition
 Reduced Day / re-entry       explanations
 schedule inertia             typed proposals only
          |                         |
          +------------+------------+
                       v
             Structured personal model
      explicit preferences · learnt tendencies
      confidence · provenance · duration ranges
      restoration/enjoyment feedback · context
                       |
                       v
              Behavioural event log
      planned · moved · started · completed
      overridden · duration · sparse feedback
```

## Canonical state

Canonical state belongs to Life Rhythm, not to an LLM conversation and not to a solver-specific data structure.

The canonical domain should represent at least:

### External commitments

Calendar-sourced or explicitly entered commitments that are not private flexible Life Rhythm placements.

Properties may include source identity, start/end, timezone, immovability, known travel/logistics and provider metadata.

### Internal intentions

One-off work the user wants Life Rhythm to remember and organise.

Properties may include purpose/title, deadline, usefulness window, duration uncertainty, eligibility, category/context and task variants.

### Rhythms

Recurring intentions expressed as frequency/window requirements rather than ordinary repeating debt.

Examples: three exercise opportunities this week, weekly social contact, twice-weekly house reset.

### Task variants

Minimum Done, normal and fuller execution forms are variants of one intention, not separate duplicate tasks.

### Protected windows and usable-day context

Family time, recovery, sleep/wake boundaries, explicit no-schedule windows and other personal boundaries.

### Internal placements

Private Life Rhythm scheduling decisions. These are distinct from external calendar events.

### Preferences

Structured explicit or learnt preferences with scope, source, confidence, support/contradiction evidence, age/decay and user-lock state.

### Behavioural events

Observed facts about interaction and execution. The event log must not embed speculative psychological explanations.

## Scheduler boundary

The product domain must not depend directly on OR-Tools, CP-SAT or any single optimisation library.

Expose a stable domain interface such as:

```text
buildPlan(input) -> plan
repairPlan(currentPlan, change) -> repairedPlan
explainPlacement(placementId) -> provenance
validatePlan(plan) -> violations
```

A deterministic heuristic is acceptable for the first vertical slice. A constraint solver is a strong candidate when the model requires it.

The scheduler owns feasibility and internal scheduling truth.

## Constraint hierarchy

Do not collapse every consideration into one opaque weighted score.

A useful starting hierarchy is:

1. absolute feasibility — hard external commitments, known hard logistics, explicitly hard sleep/boundaries, true deadline impossibilities;
2. explicit personal protection — user-declared never/protect rules;
3. essential/usefulness constraints — time-sensitive tasks and rhythm windows;
4. capacity and recovery — Reduced Day, load limits, transition overhead and recovery;
5. schedule stability — preserve reasonable placements already surfaced or accepted;
6. explicit soft preferences;
7. learnt tendencies;
8. packing efficiency.

The exact hierarchy and weights are product hypotheses and may change through testing.

## Calendar adapter

Calendar providers must sit behind an adapter interface.

The MVP needs at least one real read-only source. Additional providers can follow without changing the scheduling domain.

Rules:

- external event identity remains separate from internal placement identity;
- calendar reads inform constraints/context;
- blank time is not synonymous with capacity;
- known reliable travel may be hard-blocked;
- preparation, decompression and transition begin as explicit or soft/contextual overhead unless the user makes them hard;
- external writes are outside default automatic authority.

## Rolling planning and schedule inertia

The scheduler maintains a rolling horizon.

Near-term plans receive stronger stability protection than distant unsurfaced intentions.

A reasonable starting movement-cost ordering is:

```text
future unsurfaced flexible intention  -> cheap to move
tomorrow flexible placement           -> modest cost
today later placement                 -> higher cost
next surfaced action                  -> high cost
explicitly pinned/protected item      -> effectively immovable
external commitment                   -> outside private auto-move authority
```

When a change occurs, prefer partial repair over full reconstruction.

## Reduced Day

Reduced Day is scheduler state, not merely UI state.

It may alter:

- discretionary workload limit;
- value of recovery/protected time;
- permitted Minimum Done substitutions;
- number of initiation-heavy items;
- transition penalties;
- flexible rhythm strictness;
- deferral of lower-value flexible work.

Exact rules require trial validation.

## Re-entry

Unfinished work should be reevaluated against purpose, usefulness, deadlines, variants and recurrence semantics.

Do not encode `unfinished -> tomorrow` as a universal rule.

Re-entry is a central product hypothesis rather than a clinically established algorithm.

## Behavioural learning

Learning v0 should use the simplest adequate methods:

- actual-duration summaries and uncertainty ranges;
- repeated move/rejection counts;
- time/context acceptance rates;
- recency weighting;
- explicit versus inferred preference hierarchy;
- confidence and contradiction counts;
- sparse subjective feedback.

Do not require a neural network, contextual bandit or reinforcement-learning agent for MVP.

### Epistemic levels

Keep these distinct in storage and UI:

1. observed fact;
2. descriptive statistic;
3. predictive association;
4. experimentally supported personal rule;
5. psychological explanation;
6. physiological explanation.

Levels 5 and 6 must not be inferred from ordinary scheduler behaviour as if they were established facts.

## Preference precedence

A starting order is:

```text
current explicit instruction
> explicit persistent preference
> personally tested rule
> strong repeated association
> weak association
> population-informed default
```

Explicit preferences may be contextual or temporary. Learnt preferences should decay or be challenged when contradicted by recent behaviour.

## Optional AI boundary

AI is an interpreter, not canonical state.

Recommended write path:

```text
user language
-> model interpretation
-> typed candidate command
-> schema validation
-> authority / confidence / risk gate
-> deterministic domain validation
-> state transition
-> provenance event
```

An LLM must not receive generic database mutation authority.

Potential typed capabilities include:

- `CreateTaskCandidate`;
- `SetExplicitPreferenceCandidate`;
- `ProtectWindowCandidate`;
- `SuggestRhythmCandidate`;
- `SetTaskVariantCandidate`;
- `ReportRestorationCandidate`;
- `RequestReducedDayCandidate`;
- `ExplainPlacement`;
- `ProposeCalendarAction`.

Externally consequential proposals remain pending until appropriately authorised.

## AI memory

Important persistent knowledge belongs in structured Life Rhythm data.

- task/rhythm/calendar state -> canonical database;
- explicit preferences -> preference store;
- behavioural statistics -> learning store;
- hypotheses -> structured model with confidence/provenance;
- current conversation -> temporary AI context;
- raw conversation history -> optional/user-controlled, not scheduler truth.

Only the minimum context projection needed for a specific AI operation should leave the local/trusted boundary.

## Security model

External connector text is untrusted data, not instruction.

Controls should include:

- typed least-privilege tools;
- separate read/write connector scopes;
- deterministic validation before state changes;
- context minimisation;
- provenance on persistent beliefs;
- per-user isolation;
- explicit action gate for consequential operations;
- no secrets in prompts or normal exports;
- graceful provider failure.

## Local-first and degraded operation

AI failure must degrade intelligence, not destroy the planner.

Without AI, Life Rhythm should still be able to:

- show the plan;
- capture and complete tasks;
- apply explicit preferences;
- run Reduced Day;
- manage Minimum Done variants;
- maintain rhythms;
- replan around available calendar data;
- preserve learnt structured preferences and user data.

## Transition from the current repository

Do not rewrite the React application from scratch unless a later implementation review proves it necessary.

Reuse useful existing work:

- Dexie/Zod persistence and validation;
- task, Pool, Today and placement lifecycle logic;
- usefulness/deadline fields;
- Minimum Done/completion endpoints;
- re-entry work;
- protected-time and Life Shape concepts;
- PR #112 Workday/Non-workday profile foundation;
- rhythm persistence;
- timezone tests;
- backup/export code;
- accessibility and useful visual work.

The transition should be incremental:

1. introduce canonical scheduling-domain types and adapters over current persistence;
2. add a scheduler seam;
3. connect real calendar context;
4. replace manual `openCapacity`-only placement with derived candidate availability;
5. automate private placement and repair;
6. integrate Reduced Day, rhythms, Minimum Done and re-entry into scheduler objectives;
7. simplify the surface around the working system;
8. add behavioural learning;
9. add optional AI only after the core works.

Existing screen names and data-class boundaries may change when justified by this transition. Preserve user data and migration safety, not historical abstractions for their own sake.
