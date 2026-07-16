# Research to MVP Map

Status: Research governance note
Scope: Defines how the source library may and may not affect MVP decisions.
Last updated: 2026-06-26

This document does not create product scope. It maps research authority to MVP-safe product interpretation.

## MVP design centre

Life Rhythm’s current design centre is:

> I can open the app, see one useful next action, protect parts of my life, do the minimum if that is what fits, park things without shame, and re-enter without a catch-up pile.

Research should strengthen this centre, not expand MVP into lifestyle systems, automation, AI, biometric prediction, medication logic, social accountability, or dashboards.

## Research-to-product translation rules

| Evidence type | Product-use status | Allowed MVP effect |
| --- | --- | --- |
| Direct adult ADHD evidence | Strongest research input | Supports problem framing and cautious design rationale. |
| Broader ADHD evidence | Useful but needs adult caveats | Supports source-library context only unless adult relevance is clear. |
| Adjacent HCI / cognitive / behavioural evidence | Indirect | Supports low-risk design hypotheses and prototype tests. |
| Clinical guidelines | Boundary authority | Supports what Life Rhythm must not claim or replace. |
| Privacy / local-first / data-minimisation sources | Boundary and architecture support | Supports restraint, local-first posture, and no-surveillance defaults. |
| Commercial product benchmarks | Market scan | Supports competitor awareness and inspiration only. |
| Community sources | Qualitative signal | Supports user-research questions and copy warnings only. |
| NotebookLM synthesis | Non-canonical ideation | Supports idea parking only after safety review. |

## Corrected MVP packet set

| Role | Packets | MVP-safe interpretation |
| --- | --- | --- |
| Core | 1 | Calm re-entry, missed-task holding, no catch-up piles, optional review. |
| Core | 4 | Right-sized tasks, smallest useful version, minimum/normal/full task variants. |
| Core | 11 | Executive-function scaffolding rationale without symptom scoring. |
| Core | 12 | Task initiation support, ambiguity reduction, first-step clarity. |
| Core | 19 | Context preservation and switching/re-entry support. |
| Core | 25 | Soft scheduling boundaries, calendar load, no blank-time assumption. |
| Supporting | 9 | Calm onboarding, return-to-app recovery, notification restraint. |
| Supporting | 20 | Non-shaming language and failure-recovery tone. |
| Guardrail | 10 | Non-clinical, legal, privacy, safety, and claim boundaries. |
| Guardrail | 24 | Anti-dopamine-hack and anti-pseudoscience language. |

## MVP-safe product directions

Research currently supports the following MVP directions, with evidence-humility labels retained:

| Product direction | Research status | Safe MVP expression |
| --- | --- | --- |
| Re-entry after missed/disrupted tasks | Moderate indirect, with strong safety rationale | Calm re-entry surface; no catch-up pile; safe held tasks; optional review. |
| One useful next action | Strong product principle, moderate indirect evidence | Keep Today focused and low-load. |
| Minimum / normal / full task versions | Moderate / design-informed | Offer smaller useful versions without scoring or claims. |
| Task Pool / Holding Tray | Product infrastructure need | Hold captured, parked, not-today, deferred, and later missed tasks safely outside Today. |
| Time edges / useful windows | Moderate indirect | Describe when actions are useful, not when the user has failed. |
| Soft scheduling | Moderate indirect | Suggestions only; user confirms; openCapacity only unless later contract expands. |
| Calendar load | Moderate indirect and privacy-sensitive | Treat fixed commitments as load clusters; do not infer blank time is available. |
| Notification restraint | Moderate indirect | Start with in-app recovery; local opt-in notifications only later if separately approved. |
| No-shame language | Moderate, partially direct adult ADHD and adjacent evidence | Avoid failure, overdue, streak, score, and productivity debt copy. |
| Local-first persistence | Product trust and technical-support rationale | Keep data local unless explicit future contracts approve sync/upload. |

## Do not build from research yet

The following are not MVP-approved, even if they appear in NotebookLM, commercial benchmark sources, or packet hypotheses:

- AI coach
- AI-written task state
- automatic task prioritisation
- automatic day rebuilding
- automatic rescheduling
- calendar writes
- scheduler-owned placement
- biometric capacity prediction
- HRV / sleep / stress energy overlays
- medication peak overlays
- pharmacokinetic task timing
- crisis detection from text or biometrics
- body-doubling defaults
- public accountability
- productivity scores
- missed-task dashboards
- task-history dashboards
- completion analytics
- streak repair
- dopamine-hack or chemical-catalyst framing
- anti-scroll lockouts
- food plans, diet guidance, calorie logic, weight framing
- exercise prescriptions or symptom-improvement claims
- financial advice, spending scores, or bill-monitoring advice
- Sentry or external telemetry for task content / SQL statements without a telemetry contract

## MVP dependency map

| MVP layer | Source support | Current stance |
| --- | --- | --- |
| Task capture and safe holding | Packets 1, 4, 11, 12 | Core infrastructure. |
| Today next action | Packets 1, 4, 12, 20 | Keep low-load and non-moral. |
| Task Pool / Holding Tray | Packets 1, 4, 12, 25 | Safe holding layer; not a backlog dashboard. |
| Re-entry review | Packets 1, 9, 20 | Optional, calm, no catch-up. |
| Time-edge controls | Packets 12, 25 | Usefulness-window framing. |
| Soft suggestions | Packets 25, 19, 12 | Read-only or user-confirmed only. |
| Open-capacity placement | Packet 25 | User-confirmed; no blank-time inference. |
| Reset relief | Packets 1, 20 | Relieves pressure without deleting unseen data. |
| Auth / trial account | Packet 10 and design-spec contracts | Identity only; no silent data upload. |
| Visual polish | Packet 20 / design direction | Keep calm; do not let polish outrun daily-loop stability. |

## Prototype validation priorities

Research-backed design hypotheses should be tested before they are hardened into product rules.

High-priority prototype tests:

1. Does one-small-restart reduce re-entry friction without hiding important tasks?
2. Can users find held tasks later without feeling backlog pressure?
3. Do minimum / normal / full task versions make sense without feeling infantilising or like failure?
4. Does time-edge language communicate usefulness without urgency pressure?
5. Does openCapacity-only placement feel helpful or too limited?
6. Does re-entry review feel optional, safe, and non-judgemental?
7. Do users understand that no calendar, notification, AI, or schedule write was created unless explicitly chosen?
8. Does Reset relieve pressure without creating fear of data loss?
9. Does task-pool capture feel like safe holding rather than another inbox to manage?
10. Does the app remain calm after several days of non-use?

## Source-review trigger before implementation

Before a Codex prompt is written from research, answer:

1. Which packet or source supports this?
2. Is the evidence direct adult ADHD, broader ADHD, adjacent, market, heuristic, community, or speculative?
3. Is this a source-library conclusion, design hypothesis, MVP candidate, later feature, guardrail, or avoid item?
4. Does it touch protected domains: clinical, medication, food, movement, money, crisis, social support, notifications, calendar, AI, sync, analytics, auth, import/restore, telemetry?
5. Is a boundary contract required?
6. What must not be built in the same PR?

If the answer is unclear, do not create the implementation prompt yet.
