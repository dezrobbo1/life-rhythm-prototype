# Life Rhythm Research Basis

Status: Current concise research translation

This file summarises how the current research should influence product work. It is not a clinical guideline and it does not turn research classifications into feature permissions.

Primary project research sources:

- *Adaptive Executive-Function Support for Adults With ADHD: Evidence Review for Life Rhythm* (2026-09-02)
- *Adaptive Learning, AI Architecture, Privacy and Personalisation for Life Rhythm* (2026-09-02)

The source PDFs remain project provenance material outside the runtime repository. This file captures the product-relevant conclusions agents need.

## Scientific/product conclusion

Life Rhythm is scientifically defensible as an adaptive external executive-function support system for adults with ADHD if it is framed as support for everyday functioning rather than treatment or neurochemical manipulation.

The evidence is asymmetric:

- the executive-function problems being addressed are well established;
- several component support principles are supported;
- the integrated adaptive scheduler remains largely unvalidated;
- therefore Life Rhythm is translational product research, not an established clinical intervention.

## Evidence categories from the ADHD review

### Strong enough to design around at the principle level

- external executive-function scaffolding;
- prospective-memory offloading.

This does not mean the Life Rhythm implementation is clinically proven.

### Supported principle, implementation uncertain

Examples include:

- bounded automatic scheduling;
- calendar-aware planning;
- hidden appointment/logistics modelling;
- travel/transition support;
- task-duration learning;
- task right-sizing;
- Minimum Done as a useful implementation of task decomposition/flexible demand;
- immediate feedback;
- Reduced Day as a broad low-capacity adaptation principle;
- protected recovery;
- rhythm recurrence;
- context-aware intervention concepts;
- user-reported enjoyment/restoration as personalisation data.

### Plausible personalised hypotheses

Examples include:

- automatic rescheduling policy details;
- quick-win-before-hard-task sequencing;
- exercise immediately before demanding work;
- movement-based activation for a particular person/context;
- exact Reduced Day automatic rules;
- re-entry without blanket catch-up;
- flexible rhythm cadence;
- personalised task sequencing;
- learnt preferred times;
- causal interpretations of behavioural patterns.

These are valid things to prototype and measure. They are not ADHD-wide rules.

### Claims that should not be made

Do not claim that Life Rhythm:

- treats ADHD;
- is clinically proven to improve ADHD without appropriate evidence;
- regulates, optimises, resets or schedules dopamine;
- provides measurable dopamine hits;
- detects low dopamine;
- detects neurological overstimulation from ordinary app behaviour;
- knows the user's neurological or ADHD state;
- scientifically determines one optimal ADHD schedule.

Use behavioural framing instead: reward-aware, motivation-aware, activation-aware, context-aware and learned personal tendencies.

## Research-compatible automation principle

The evidence does not require Life Rhythm to remain manually scheduled.

The correct interpretation is:

> Automatic adaptive scheduling is a central product hypothesis intended to reduce supported executive-function burdens. Its decision rules, degree of autonomy and measurable benefit require iterative validation.

The preferred human-control model is risk-calibrated automation:

- private, low-risk, reversible scheduling may be highly automated;
- uncertain or higher-impact internal actions may be surfaced or made easy to undo;
- external, relational, destructive or otherwise consequential actions require stronger user authority.

## Calendar principle

Calendar events are constraints and context, not complete descriptions of capacity.

Do not equate:

```text
blank calendar = available capacity
```

A better model is:

```text
calendar gap - logistics - explicit protection - contextual overhead - uncertainty reserve
```

Known travel may be hard. Preparation, transition and recovery should usually begin as explicit or learnt soft/contextual overhead rather than fixed ADHD-wide buffers.

## Reduced Day, Minimum Done and re-entry

These ideas should be retained and integrated into scheduling rather than treated as isolated features.

Reduced Day should reduce demand in the scheduling model.

Minimum Done should be an eligible smaller execution variant of one intention, not a duplicate task.

Re-entry should reevaluate unfinished work against deadline, usefulness, purpose, variants and recurrence semantics rather than blindly treating every miss as debt.

Exact algorithms remain product hypotheses.

## Rhythms

A rhythm should represent an intention over time rather than an accumulating streak or repeating debt.

Examples:

- exercise approximately three times this week;
- house reset twice this week;
- call parents roughly weekly.

The scheduler should help such patterns fit real life rather than punish missed occurrences.

## Personal learning

Life Rhythm may safely distinguish:

1. observed fact — what actually happened;
2. descriptive statistic — what has tended to happen;
3. predictive association — what currently appears more likely to work;
4. experimentally supported personal rule — what repeated safe comparison suggests;
5. psychological explanation;
6. physiological explanation.

The ordinary product should operate primarily on levels 1–4.

Do not infer levels 5–6 as facts from scheduling traces.

## Subjective feedback

Useful user-reported dimensions may include:

- enjoyable;
- restorative;
- calming;
- activating;
- draining;
- hard to stop;
- helps me start;
- helps afterwards.

Keep these multidimensional and contextual. Something can be enjoyable without being restorative.

Ask sparingly. The information value of a prompt should exceed its interruption cost.

## Learning and experimentation

The research favours simple, inspectable learning before sophisticated ML.

Recommended progression:

- descriptive statistics;
- duration learning;
- repeated move/rejection patterns;
- recency weighting and confidence;
- opt-in within-person/micro-randomised experiments for genuinely uncertain personal strategies;
- contextual bandits only later if the data and safe action set justify them;
- no full reinforcement learning unless simpler methods demonstrably fail and a defensible long-term objective exists.

## AI architecture conclusion

The strongest architecture from the technical review is:

> deterministic scheduler + statistical learning + optional LLM

AI should make Life Rhythm easier to talk to, not become the source of scheduling truth.

Appropriate AI roles include:

- conversational capture;
- task decomposition;
- natural-language preference interpretation;
- ambiguity detection;
- grounded scheduling explanations;
- summarising observed patterns.

AI-originated changes should flow through typed commands, schema validation, authority/risk checks and deterministic domain validation.

Do not allow an LLM to bypass canonical state transitions or silently invent deadlines/preferences.

## Privacy conclusion

Life Rhythm may hold unusually intimate behavioural data. Prefer:

- local-first structured state;
- data minimisation;
- bounded raw event retention where possible;
- derived preferences rather than indefinite granular history when appropriate;
- provenance;
- inspectability;
- correction/deletion/export;
- minimal context projection to external AI providers.

Avoid inferred mental-health labels merely because a model can generate them.

## Primary evaluation objective

Evaluate executive burden before productivity.

Important outcomes include:

- planning time;
- number of manual scheduling operations;
- forgotten intentions;
- conflict/override rate;
- initiation latency;
- recovery effort after disruption;
- Reduced Day burden;
- unnecessary visible schedule movement;
- interaction burden;
- trust;
- autonomy;
- whether learnt policies outperform generic policies for the individual.

A feature should be changed or removed if it consistently increases planning burden, creates schedule churn, produces high override rates, increases pressure, causes important misses or fails to show useful benefit after adequate testing.

## Governance rule

Research constrains claims and identifies risks. It also identifies hypotheses worth testing.

Do not convert:

> not yet validated

into:

> forbidden to prototype.

The repository should protect true scientific/safety boundaries while remaining free to discover the best product implementation.
