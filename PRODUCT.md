# Life Rhythm Product

Status: Current product direction

## Purpose

Life Rhythm is an adaptive external executive-function support system designed primarily for adults with ADHD.

Its job is to reduce the cognitive and administrative work involved in remembering, organising, prioritising, initiating, sequencing and replanning everyday life.

The objective is not maximum productivity. The objective is to make everyday life easier to navigate.

> Power underneath. Calm on the surface.

## Product thesis

Life Rhythm should carry executive work rather than merely teach the user how to do that work manually.

The user provides reality:

- calendar commitments;
- tasks and future intentions;
- useful rhythms;
- deadlines and usefulness windows;
- protected time and personal boundaries;
- explicit preferences;
- occasional corrections and subjective feedback.

Life Rhythm maintains a workable plan across that reality. Flexible internal work may be scheduled and rescheduled automatically. When circumstances change, the system should repair the flexible parts of the plan rather than require the user to reconstruct the day.

The long-term experience should approach:

> Now — this.
>
> Later — these few things.
>
> Something changed — I rearranged the flexible parts.
>
> Low-capacity day — I reduced what today is asking of you.
>
> Not right — move it or tell me why.

A correction is useful learning data, not evidence that the user failed.

## What Life Rhythm is not

Life Rhythm is not primarily:

- a conventional to-do list;
- a manual calendar planner;
- a habit streak tracker;
- a productivity dashboard;
- an AI agent that improvises the user's life;
- a medical treatment, diagnostic system or neurochemical monitor.

The current Today / Plan / Pool / Library navigation, Holding Tray model, object grammar and existing soft-placement loop are implementation history. They may be retained where useful, but they are not permanent product laws.

## Product layers

The intended architecture is:

> deterministic constraints + explicit preferences + behavioural learning + reversible automation + optional intelligent interpretation

### Deterministic life and scheduling model

The canonical system should know what is actually scheduled and what constraints make a schedule valid.

This includes:

- calendar commitments;
- tasks;
- rhythms;
- deadlines and usefulness windows;
- travel and logistics;
- protected time;
- sleep/wake and usable-day boundaries;
- Reduced Day;
- Minimum Done and other valid task variants;
- internal placements and rescheduling;
- state transitions and data integrity.

### Behavioural learning

Life Rhythm may learn behaviourally relevant tendencies such as:

- realistic durations;
- repeatedly rejected periods;
- preferred or successful periods;
- transition difficulty;
- response to calendar-heavy periods;
- useful activity sequences;
- accepted and overridden placements;
- user-reported enjoyment, restoration, calming, activation or draining effects.

These are observations, associations and preference hypotheses. They are not diagnoses or hidden biological measurements.

### Optional AI

AI may make Life Rhythm easier to communicate with. It may interpret natural language, help structure vague intentions, decompose tasks, explain scheduling decisions, summarise observed patterns and propose typed changes.

AI is not the source of scheduling truth. Persistent Life Rhythm state remains structured and validated by the application.

## True invariants

These are the product boundaries agents should treat as genuine constraints unless the owner explicitly changes them.

1. **Non-clinical boundary.** Do not claim that Life Rhythm diagnoses, treats or clinically manages ADHD, regulates dopamine, detects neurological states or provides medical advice.
2. **No hidden neurochemical inference.** Behavioural data may support scheduling associations; it must not be presented as evidence of dopamine level, neurological overstimulation or another unmeasured physiological state.
3. **Deterministic state integrity.** Canonical scheduling and application state must pass typed validation and domain rules. An LLM must not bypass those transitions.
4. **Risk-calibrated automation.** Low-risk, private and reversible internal scheduling may be automatic. Consequential external actions require stronger user authority.
5. **No silent destructive or relational actions.** Do not silently delete user data, cancel commitments, move another person's appointment, send messages, spend money or take similarly consequential actions.
6. **Blank calendar time is not automatically usable capacity.** Calendar data are constraints and context, not a complete model of human capacity.
7. **User correction remains available.** Automatic scheduling must be inspectable and reasonably easy to move, undo, protect or correct.
8. **Personal data remain user-controlled.** Prefer local/structured storage, data minimisation, exportability and deletion. Only necessary context should reach external AI services.
9. **No shame-based optimisation.** Avoid streak pressure, failure/debt framing, punitive catch-up, productivity scoring and design that treats recovery as wasted time.
10. **Core operation does not depend on AI.** AI failure should degrade optional intelligence, not destroy the planner or its canonical state.

## Research-supported principles versus product hypotheses

Research informs direction; it does not freeze implementation.

Strong or supported principles include external executive-function scaffolding, prospective-memory offloading, calendar-aware planning, task right-sizing, immediate feedback, Reduced Day as a broad low-capacity adaptation principle, rhythms, recovery protection and context-sensitive support.

Central product hypotheses that require validation include:

- bounded automatic private scheduling;
- automatic private rescheduling;
- schedule inertia;
- personalised timing and sequencing;
- flexible rhythm cadence;
- re-entry without blanket catch-up;
- movement-before-task strategies;
- quick-win sequencing;
- subjective restoration/enjoyment feedback improving schedule quality;
- behavioural learning reducing executive burden.

A hypothesis is permission to prototype and measure, not a prohibition.

## Primary product test

The primary question for Life Rhythm is:

> Does the app make fewer executive decisions necessary?

Task completion is secondary to whether Life Rhythm reduces planning burden, forgotten intentions, manual replanning, interaction burden and cognitive surprise while preserving trust and autonomy.
