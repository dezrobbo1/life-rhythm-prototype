# Packet V3 Priority Map

Status: Research governance note
Scope: Defines the next packet-revision order and consolidation plan after Packet 1 V3.
Last updated: 2026-06-26

This document is a sequencing guide. It does not approve new features or change current implementation state.

## Current anchor

Packet 1 V3 is the current anchor for re-entry and missed-task recovery.

Packet 1 V3 establishes the standard that should be applied across the packet library:

- separate direct adult-ADHD evidence from adjacent evidence
- separate evidence from product judgement
- treat exact app mechanics as prototype hypotheses when direct adult-ADHD interface evidence is sparse
- preserve non-clinical boundaries
- avoid shame, catch-up piles, dashboards, productivity scoring, streak repair, and behavioural inference

## Corrected V3 order

| Rank | Packet or group | Action | Reason | Expected output |
| ---: | --- | --- | --- | --- |
| 1 | Packet 4 — Right-Sized Tasks | Upgrade to V3 | Directly shapes smallest useful next action and minimum/normal/full task variants. | Canonical task-sizing packet |
| 2 | Packet 12 — Task Initiation / Avoidance / Time Estimation | Upgrade to V3 | Core initiation logic and ambiguity-reduction model. | MVP initiation packet |
| 3 | Packet 25 — Calendar Load / Soft Scheduling Boundaries | Upgrade to V3 | Prevents scheduler/calendar overreach and defines blank-time limits. | Soft-scheduling boundary packet |
| 4 | Packet 20 — Emotional Regulation / Shame / Failure Recovery | Upgrade to V3 | Keeps re-entry, retention, and task feedback non-shaming. | Tone and failure-recovery guardrail |
| 5 | Packet 9 — Retention / Re-entry / Notifications | Upgrade to V3 | Controls onboarding, app-return recovery, and notification restraint. | Calm re-engagement packet |
| 6 | Packet 19 — Work Focus / Context Switching / Re-entry | Upgrade to V3 | Supports focus switching, work re-entry, and context preservation. | Work re-entry packet |
| 7 | Packets 2 + 21 + 24 | Merge / rewrite | Motivation, reward, novelty, progress, and dopamine language overlap. | Motivation / feedback packet with guardrails |
| 8 | Packets 3 + 15 | Merge | Phone drift, anti-scroll, boredom, and return-to-task overlap. | Later anti-drift packet |
| 9 | Packets 6 + 14 | Merge into source-only packet | Food rhythm and meal planning duplicate each other and carry high safety risk. | Food-rhythm source packet with strict boundaries |
| 10 | Packet 10 — Safety / Ethics / Legal Boundaries | Refresh | Should track the revised source library and current app scope. | Updated master boundary packet |

## MVP packet grouping

| Role | Packets | Product use |
| --- | --- | --- |
| MVP core | 1, 4, 11, 12, 19, 25 | Defines re-entry, task sizing, executive-function scaffolding, task initiation, work/context re-entry, and soft-scheduling boundaries. |
| MVP supporting | 9, 20 | Defines calm onboarding/re-entry and no-shame tone. |
| Guardrail-only | 10, 24 | Defines non-clinical boundaries and anti-dopamine-hack language rules. |
| Merge before use | 2 + 21 + 24, 3 + 15, 6 + 14 | Must be reconciled before they drive product decisions. |
| Source-only / later | 6, 7, 13, 14, 16, 17, 18, 22, 23 | Useful context or later-feature research; not MVP feature authority. |

## Packet-specific directives

### Packet 4 — Right-Sized Tasks

Primary use:

- canonical source for minimum / normal / full task versions
- smallest useful next action
- task-size mismatch
- ambiguity reduction
- flexible completion endpoints

Must avoid:

- rigid sizing formulas
- completion scoring
- universal claims that one sizing model works for all adults with ADHD
- productivity-hack framing

### Packet 12 — Task Initiation / Avoidance / Time Estimation

Primary use:

- explain task initiation without moralising
- separate ambiguity, avoidance, timing uncertainty, and task-size mismatch
- support Help Me Start and first physical action concepts

Must avoid:

- single-cause explanations
- universal start engine claims
- hidden nudges
- shame or willpower framing

### Packet 25 — Calendar Load / Soft Scheduling Boundaries

Primary use:

- calendar time is load context, not free capacity
- blank time is not automatically available
- fixed commitments have hidden edges
- scheduler suggestions must be user-confirmed

Must avoid:

- automatic scheduling
- calendar writes
- treating empty slots as task space
- schedule coercion
- scheduler-owned day logic

### Packet 20 — Shame / Emotional Recovery / Failure Recovery

Primary use:

- cross-packet language safety
- re-entry tone
- failure recovery without therapy framing
- avoiding punitive feedback

Must avoid:

- therapy scripts
- crisis substitution
- emotional diagnosis
- AI reflection coach

### Packet 9 — Retention / Re-entry / Notifications

Primary use:

- calm onboarding
- app-return recovery
- notification restraint
- return without pressure

Must avoid:

- push-heavy retention
- streak nudges
- “come back” pressure
- engagement metrics that override user wellbeing

### Packet 19 — Work Focus / Switching / Re-entry

Primary use:

- context preservation after interruption
- switching-cost awareness
- work re-entry without surveillance

Must avoid:

- productivity dashboards
- manager-facing features
- workplace accommodation or legal advice
- work-performance scoring

## Merge directives

### Packets 2 + 21 + 24

Retain:

- small wins
- reward salience and boredom as relevant context
- low-pressure progress language
- anti-pseudoscience and anti-dopamine-hack guardrails

Remove or rewrite:

- dopamine-hack framing
- chemical-catalyst language
- neurochemical certainty
- streaks, scores, pressure loops
- percent-progress obligations

### Packets 3 + 15

Retain:

- optional return-path support
- low-friction re-entry after phone drift
- anti-dark-pattern sensitivity

Remove or rewrite:

- addiction framing unless evidence-specific and carefully bounded
- punitive lockouts
- moralised scrolling copy
- coercive anti-phone tools

### Packets 6 + 14

Retain:

- routine and environmental support around food-related tasks
- low-friction prep context
- capacity-aware household support

Remove or rewrite:

- diet advice
- calorie, weight, restriction, or body-image framing
- eating-disorder-risk blind spots
- medical nutrition claims

## Packet 10 note

Packet 10 is listed later in the V3 order because it should be refreshed after several V3 packets clarify scope. However, its existing boundaries should be used now as a live checklist during every V3 pass.

Any packet touching food, movement, money, sleep, emotion, social support, calendar data, notifications, AI, auth, sync, analytics, or crisis resources needs explicit boundary wording before product use.

## Completion definition for each V3 packet

A V3 packet is not complete until it includes:

- purpose and non-clinical scope
- evidence hierarchy
- adult-ADHD specificity review
- source quality notes
- overclaim risks
- safe Life Rhythm interpretation
- what not to build
- MVP / later / source-only status
- prototype validation needs
- boundary language for product use
