# Gate 7 Exit Report

Status: **GATE 7 EXIT — PASS**

Reviewed main: `4bde6a9fb690c0a34934914d05a52013e7e0b210`  
Review date: 2026-09-25  
Scope: Gate 7A–7E behavioural-learning progression and the transition to Gate 8

## Purpose

Gate 7's stated exit condition in `MVP_PLAN.md` is:

> at least a small set of scheduling choices can improve from the user's own history while remaining explainable and correctable.

This report decides whether the implemented Gate 7 progression satisfies that condition. It is an acceptance and handoff record, not another learning implementation slice.

## Repository-backed progression

| Slice | Implemented evidence | Role in exit decision |
| --- | --- | --- |
| Gate 7A | strict observed-behaviour event ledger with provenance, transactional write boundaries, local export/delete controls and no psychological inference | establishes trusted factual learning input |
| Gate 7B | deterministic descriptive statistics over trusted events, including template-linked duration summaries and read-health semantics | turns facts into transparent statistics without scheduler authority |
| Gate 7C | strict explicit-preference storage and precedence foundation | establishes explicit user authority above inferred behaviour |
| Gate 7D1 | live deterministic preference integration, target-scoped mutation safety, bounded repair authority and Undo preservation | proves preferences can affect live scheduling safely |
| Gate 7D2 | inspect/create/edit/delete/export/clear controls and grounded "Why this time?" reasons | makes explicit guidance user-visible and correctable |
| Gate 7E | template-scoped duration learning from trusted positive completion durations, conservative Normal-duration projection, bounded confidence, provenance and per-template correction/disable/reset | supplies the first bounded scheduling choice improved from the user's own history |

## Exit-condition assessment

### 1. A scheduling choice improves from personal history — PASS

Gate 7E derives template-scoped duration evidence from schema-valid `taskCompleted.actualMinutes` observations.

When enough healthy evidence exists, the Normal scheduling variant can reserve the observed upper-quartile duration rather than the saved Normal duration. Minimum and Full remain user-authored.

This is a real scheduler input derived from the person's own repeated history rather than a display-only statistic.

### 2. The learning remains explainable — PASS

The scheduler projection records duration-learning provenance. The existing "Why this time?" presentation can state when a learnt or user-corrected duration affected the placement.

The evidence remains inspectable through:

- positive trusted sample count;
- median actual minutes;
- conservative observed upper-quartile estimate;
- confidence state;
- current scheduler reservation.

No psychological, physiological or causal explanation is inferred.

### 3. The learning remains correctable — PASS

For each affected template the user can:

- disable learning and return to the saved Normal duration;
- enter an explicit corrected whole-minute duration;
- remove the explicit control and use learning again.

Explicit user authority remains separate from behavioural evidence. Malformed or unreadable learning/control state fails closed rather than being silently replaced.

### 4. Scheduler authority remains bounded — PASS

The deterministic scheduler still owns feasibility, protected boundaries, explicit preferences, Reduced Day semantics and schedule stability.

Duration learning changes only the projected Normal duration for a matching template. It does not rewrite canonical task/rhythm variant definitions.

Only future scheduler-owned Normal placements for templates whose effective duration authority or minutes changed are eligible for bounded release and repair.

### 5. The epistemic boundary remains intact — PASS

Gate 7 preserves the intended separation:

```text
observed facts
→ descriptive statistics
→ bounded scheduling hypothesis
→ deterministic scheduling use
```

The implementation does not infer ADHD state, motivation, dopamine, psychological cause or a universal preferred schedule.

## Deferred learning that does not block exit

The following remain deliberately deferred:

- preferred-time inference from behavioural counts;
- repeated-move/rejection inference;
- category/Area/Task type duration learning;
- variant-specific learnt durations;
- recency weighting or preference decay;
- transition-duration learning;
- enjoyment/restoration/activation learning;
- broad "What Life Rhythm has learnt about me" UI;
- contextual bandits, reinforcement learning, neural networks or LLMs.

Gate 7 does not require those mechanisms to satisfy its stated exit condition.

## Gate 8 readiness follow-ups

These do not reopen Gate 7, but they should be resolved in Gate 8A before a longitudinal personal trial begins.

### A. Duration-control portability

Gate 7E stores explicit per-template duration controls in a versioned local sidecar. The current settings backup is intentionally settings/day-profile-only and does not include this sidecar.

Gate 8A should add a bounded export/recovery path for duration controls or explicitly extend an appropriate backup contract without weakening existing data-class boundaries.

### B. Replace obsolete personal-trial guidance

The existing:

- `app/docs/personal-trial-readiness-report.md`;
- `app/docs/personal-trial-launch-note.md`;
- `app/docs/personal-trial-checklist.md`;

describe the PR #104-era manual soft-suggestion product. They contain now-obsolete instructions such as treating automatic scheduling/calendar integration as unavailable and relying on `openCapacity` soft placement.

They are marked superseded by this exit PR. Gate 8A must produce a current protocol based on the adaptive scheduler actually on `main`.

### C. Gate 8 evidence protocol

Gate 8 measures executive burden before raw completion. Gate 8A should map each outcome to an existing automatic signal, a minimal new local event/derived metric, or a deliberately sparse user report.

The protocol should cover at least:

- minutes spent planning;
- manual scheduling actions;
- forgotten important intentions where observable;
- invalid/conflicting placements;
- override/Undo rate;
- initiation latency where observable;
- recovery time/effort after disruption;
- Reduced Day burden and next-day re-entry;
- unnecessary visible schedule movement;
- clarification/interaction burden;
- perceived trust and autonomy;
- continued voluntary use.

Do not invent metrics the current data cannot support. Add instrumentation only where the information value justifies the interaction or implementation burden.

### D. Current-device readiness

PR #155 had automated component coverage and hosted preview/build validation, but did not claim a fresh manual desktop/narrow/mobile/keyboard walkthrough.

Gate 8A should perform the current readiness walkthrough before Day 1 rather than inheriting old PR #104 acceptance.

## Decision

**GATE 7 EXIT — PASS**

The implemented product now has a bounded scheduling choice that improves from trusted personal history and remains inspectable, explainable, reversible and user-correctable.

The next milestone is:

**GATE 8A — PERSONAL TRIAL READINESS + EVIDENCE PROTOCOL**

Do not add another Gate 7 learning mechanism by default. The next product question is whether the integrated adaptive system reduces executive/planning burden in real use without unacceptable churn, conflict, pressure or loss of trust.
