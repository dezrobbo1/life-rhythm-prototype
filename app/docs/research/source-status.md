# Research Source Status Register

Status: Source governance note
Scope: Records which project research sources are canonical, provisional, source-only, or inspiration-only.
Last updated: 2026-06-26

This document is a project-source control layer. It does not change app behaviour, schemas, persistence, scheduling, auth, sync, AI, notifications, analytics, calendar integration, or import/restore execution.

## Source hierarchy

| Tier | Status | Use | Examples | Product authority |
| --- | --- | --- | --- | --- |
| 1 | Canonical product direction | Determines current product boundaries, implementation state, and near-term scope. | `app/docs/life-rhythm-current-design-spec.md`; current contracts in `app/docs/` | Highest |
| 2 | Canonical V3 packet direction | Can guide MVP and packet-specific product constraints when aligned with the design spec. | Packet 1 V3: Re-entry and Missed-Task Recovery | High |
| 3 | Source-library evidence | Can support design principles and future V3 packet upgrades, but must retain evidence labels. | Existing Life Rhythm research packets, especially packets 4, 11, 12, 19, 20, 25 | Medium |
| 4 | Provisional audit / triage | Can guide sequencing and review priorities, but cannot be treated as full packet verification. | Full-library validation audit | Medium-low |
| 5 | Non-canonical ideation | Can be mined for ideas only after safety review and evidence classification. | NotebookLM v1.2 reports, app benchmark lists, community threads, commercial product pages | Low |
| 6 | Quarantined speculative material | Must not drive implementation until decomposed into sourced, evidence-weighted claims. | Neuro-computational models, medication-cycle scheduling, biometric energy models, crisis-detection concepts | None |

## Canonical product authority

The current design spec remains the project authority for product identity, implementation state, and boundaries.

Current product identity:

- local-first ADHD-optimised rhythm and re-entry app
- non-clinical self-management support
- calm task initiation
- protected time
- backup-safe persistence
- future soft scheduling

Current product prohibitions:

- no diagnosis or treatment language
- no medical outcome claims
- no therapy or coach-authority framing
- no compliance monitoring
- no shame or failure language
- no scores, streak pressure, public accountability, or coercive reminders
- no productivity punishment
- no dopamine-hack language or gamified pressure
- no “you are behind” framing
- no scheduler writes, calendar writes, AI writes, analytics, notification system, cloud sync, task-history dashboard, or import/restore execution unless separately contracted

Core rule:

> Power underneath. Calm on the surface.

## Canonical Packet 1 status

Packet 1 V3 is the current canonical research packet direction for re-entry and missed-task recovery.

Safe use:

- re-entry is a primary workflow
- missed tasks are routing data, not failure data
- missed tasks must not auto-stack into Today
- backlog review should be optional
- one small restart path is an MVP-suitable hypothesis
- routing logic needs prototype validation
- no missed-task dashboards, failure copy, streak repair, productivity scoring, or repeated-miss inference

Evidence status:

- strong support for non-clinical and product-boundary caution
- moderate indirect support for low-friction re-entry mechanics
- sparse direct adult-ADHD interface evidence
- exact wording, timing, thresholds, and algorithms remain prototype hypotheses

## Existing packet-library status

The existing packet library should be retained as source-library evidence, not automatically treated as current product spec.

Current corrected packet grouping:

| Role | Packets |
| --- | --- |
| MVP core | 1, 4, 11, 12, 19, 25 |
| MVP supporting | 9, 20 |
| Guardrail-only | 10, 24 |
| Merge before product use | 2 + 21 + 24, 3 + 15, 6 + 14 |
| Source-only / later | 6, 7, 13, 14, 16, 17, 18, 22, 23 |

The validation audit is useful as a priority map, but it did not complete direct line-by-line inspection of every packet and citation. Treat packet verdicts outside Packet 1 as provisional until each packet is upgraded or reconciled directly.

## NotebookLM v1.2 status

The NotebookLM documents are non-canonical ideation documents.

They may be used for:

- language exploration
- feature parking
- competitor / inspiration scanning
- architecture brainstorming
- identifying research questions

They must not be used as:

- implementation specifications
- evidence anchors
- MVP scope authority
- clinical, medication, biometric, AI, notification, sync, or crisis-flow authority
- public-facing product language without rewrite

High-risk NotebookLM claims to quarantine:

- physical-therapy model framing
- wheelchair-model public framing
- INCUP as neuroscience proof
- dopamine / norepinephrine / chemical-catalyst language
- medication peak overlays or pharmacokinetic scheduling
- wearable HRV / stress / sleep-based energy prediction
- automatic day rebuilding or automatic rescheduling
- crisis detection from text or biometrics
- AI coach / agentic decision authority
- Sentry failed-SQL telemetry containing user content
- CRDT collaboration and sync-server assumptions before sync is contracted

## External benchmark source status

Commercial app pages, benchmark articles, coaching frameworks, Reddit/community discussions, product blogs, and technical articles should be labelled by type before use.

Allowed labels:

- clinical guideline
- peer-reviewed research
- systematic review / meta-analysis
- HCI / technical research
- technical implementation reference
- commercial product benchmark
- coaching heuristic
- community / user voice
- marketing material
- internal speculative synthesis

Commercial, community, and heuristic sources can suggest questions or patterns. They cannot validate adult-ADHD product claims.

## Source-use rule for future PRs

A future PR must not import a research claim into product behaviour unless the claim is classified as one of:

1. canonical product boundary
2. source-library conclusion
3. design hypothesis for prototype testing
4. later-feature candidate
5. inspiration only
6. avoid / quarantined

If a claim touches data movement, writes, visibility, user interpretation, notifications, calendar access, AI, sync, analytics, auth, crisis resources, medication, food, movement, money, or social accountability, it needs a boundary contract before implementation.
