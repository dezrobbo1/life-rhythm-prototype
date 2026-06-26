# Non-Canonical Source Notes

Status: Source governance note
Scope: Prevents ideation, benchmark, and heuristic material from becoming accidental product scope.
Last updated: 2026-06-26

This document is deliberately restrictive. It protects the current Life Rhythm design centre from research-source drift.

## Summary rule

NotebookLM documents, commercial app pages, Reddit posts, coaching frameworks, product blogs, and internal speculative syntheses are not implementation specifications.

They can be useful for inspiration, competitor scanning, vocabulary, and research questions. They cannot validate adult-ADHD product claims or override the current design spec.

## NotebookLM v1.2 documents

The NotebookLM v1.2 documents are classified as non-canonical ideation.

Use them for:

- concept exploration
- language alternatives
- possible future-source questions
- identifying overreach to avoid
- technical architecture brainstorming that still requires separate implementation validation

Do not use them for:

- MVP scope
- final product claims
- evidence-strength labels
- clinical, medication, biometric, AI, notification, crisis, sync, telemetry, or scheduling decisions
- public product language
- repo implementation tasks without a separate boundary contract

## Safe extractable ideas

The following ideas may be retained after evidence and safety rewrite:

| Idea | Safe canonical interpretation |
| --- | --- |
| Cognitive prosthetic | External scaffolding for task initiation, task holding, re-entry, and soft planning. |
| External memory | The app can hold context so the user does not have to. |
| Shame-free re-entry | Re-entry is a primary workflow, not a penalty state. |
| Reset valve | The user can safely clear pressure from Today without losing held tasks. |
| Minimum / normal / full | Tasks can have smaller useful versions. |
| Local-first | Fast, private, backup-safe local persistence is part of accessibility and trust. |
| Visual time aids | Visual cues may reduce load when they stay calm and non-urgent. |
| Hidden edges | Preparation, transition, cleanup, and recovery are part of the real task burden. |

## Quarantined or rejected ideas

The following ideas must not enter implementation from NotebookLM output:

| Idea | Status | Reason |
| --- | --- | --- |
| Physical therapy model | Avoid | Implies treatment, rehabilitation, or training the user into a different pattern. |
| Wheelchair model as public copy | Avoid in public copy | Useful internally, but can sound reductive or medicalised. |
| Interest-Based Nervous System as product evidence | Inspiration only | Heuristic, not strong neuroscience foundation for product behaviour. |
| INCUP as evidence anchor | Inspiration only | May help identify optional start supports, but must not drive claims. |
| Dopamine / norepinephrine / chemical-catalyst language | Avoid | Conflicts with anti-dopamine-hack boundary. |
| Gamified task framing | Avoid | Conflicts with no scores, no streak pressure, and no gamified pressure. |
| Simulated consequences / urgency pressure | Avoid | Risks coercion and anxiety. |
| Medication peak overlay | Avoid | Medication-advice and false-precision risk. |
| Pharmacokinetic task scheduling | Avoid | Medical inference and scheduling-overreach risk. |
| Automatic spiciness based on medication window | Avoid | Medication-based automation is outside current scope. |
| Wearable HRV / sleep / stress energy model | Later research only | Privacy, accuracy, and clinical-inference risks. |
| Crisis detection from text or biometrics | Avoid unless separately expert-reviewed | High-risk safety, false-positive, and false-negative domain. |
| Automatic day rebuilding | Avoid | Conflicts with user-confirmed scheduler boundary. |
| Auto-archive after absence | Avoid | Data-loss and trust risk unless explicit, previewed, undoable, and researched. |
| AI coach / agentic authority | Avoid | AI must remain proposal-only and user-confirmed. |
| Sentry failed-SQL telemetry | Avoid without telemetry contract | Failed SQL can expose task titles, notes, times, and personal context. |
| CRDT collaboration | Future architecture only | Sync/collaboration is not current MVP and needs separate contract. |

## External source categories

All external sources must be labelled before use.

| Source type | Examples | Safe use | Not safe to infer |
| --- | --- | --- | --- |
| Clinical guideline | NICE, AADPA | Boundaries, clinical scope, adult ADHD functional context | Product mechanics are validated |
| Peer-reviewed adult ADHD research | Adult ADHD reviews / studies | Mechanism-level support | A specific UI works |
| HCI / cognitive research | interruption, reminders, personal informatics, notification fatigue | Adjacent design rationale | Adult-ADHD-specific proof |
| Technical implementation reference | local-first, SQLite, OPFS, browser APIs | Architecture options | ADHD evidence |
| Commercial benchmark | Lifestack, Tiimo, Fabric, Inflow, ClickUp, Goblin Tools | Competitor scan, feature patterns, language examples | Efficacy or evidence-based ADHD support |
| Coaching heuristic | INCUP, interest-based motivation | Vocabulary and research questions | Neuroscience proof |
| Community/user voice | Reddit, forums, comments | Qualitative signals and interview prompts | Prevalence, clinical evidence, or design validation |
| Product marketing | habit-app blogs, productivity pages | Market framing to critique | Evidence anchor |
| Internal speculative synthesis | neuro-computational models | Quarantine until decomposed into sourced claims | Implementation authority |

## Commercial app benchmark rules

Commercial benchmark pages can help identify market patterns such as:

- visual time
- task breakdown
- low-friction capture
- energy-aware claims
- AI-organisation claims
- shame-free marketing language
- body-doubling or accountability patterns

They cannot justify:

- wearable scheduling
- AI auto-organisation
- automatic rescheduling
- biometric capacity prediction
- medication-window planning
- evidence claims
- MVP expansion

## Community-source rules

Community posts can be used to generate research questions:

- What makes a productivity app feel punitive?
- What makes a reset feel safe?
- What copy creates shame?
- What makes users avoid reopening an app?
- What support feels like help rather than surveillance?

They cannot be used to establish:

- prevalence
- efficacy
- clinical claims
- adult-ADHD generalisations
- implementation priority

## Technical-source rules

Technical articles can inform architecture exploration only.

They must not become product claims such as:

- “SQLite/OPFS is required for ADHD users.”
- “A 500ms delay causes ADHD task abandonment.”
- “Local-first is evidence-based ADHD treatment.”

Safe wording:

> Local-first architecture may support Life Rhythm’s goals of speed, ownership, offline resilience, privacy, and backup-safe persistence.

## Default action when a non-canonical source conflicts with the design spec

The design spec wins.

If a source suggests a feature that conflicts with current boundaries, classify it as:

- later research only, or
- avoid, or
- inspiration only after rewrite

Do not create Codex implementation prompts from non-canonical material unless it has first passed source classification and boundary review.
