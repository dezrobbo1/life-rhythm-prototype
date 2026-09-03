# Life Rhythm source index

Status: Current source/provenance map
Date: 2026-09-03

This index records evidence and historical design material used to inform Life Rhythm. It is not runtime input and it is not current product authority.

## Repository authority

Current product and implementation direction are defined in:

- [`../../PRODUCT.md`](../../PRODUCT.md) — product purpose, direction and true invariants;
- [`../../MVP_PLAN.md`](../../MVP_PLAN.md) — active MVP gate sequence;
- [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — target architecture and transition strategy;
- current `/app` code and tests — implemented behaviour;
- [`../RESEARCH_BASIS.md`](../RESEARCH_BASIS.md) — concise evidence translation and scientific boundaries;
- [`../DOCUMENTATION_AUTHORITY.md`](../DOCUMENTATION_AUTHORITY.md) — repository authority map.

The former `app/docs/life-rhythm-current-design-spec.md` and the many feature contracts in `app/docs` remain historical rationale, current-runtime references where still accurate, and implementation evidence. They do not override the active MVP direction.

## Current provenance bundle

The supplied source bundle is:

- `Life_Rhythm_All_Project_Sources_2026-07-12.zip`

The bundle is external provenance material. It contains the extracted Design Source Pack v1.2, Packet 1-25 source collection, project-source governance additions, research/design documents, handovers, text derivatives, visual references and historical `/app` previews.

The bundle is not loaded by the app runtime and is not a substitute for current repository product documents.

## Active source layers

| Layer | Source | Use |
| --- | --- | --- |
| Product direction | `PRODUCT.md` | Product purpose, direction and true invariants |
| MVP roadmap | `MVP_PLAN.md` | Current development gates and evidence targets |
| Target architecture | `ARCHITECTURE.md` | Scheduling, learning, AI and migration direction |
| Current implementation | `/app` code + tests | What the product actually does today |
| Evidence translation | `docs/RESEARCH_BASIS.md` | Current scientific/safety interpretation |
| Evidence-balanced UX | `docs/ux/Life_Rhythm_Design_Specification_v1_2_Evidence_Balanced.md` | Research traceability and historical UX rationale |
| Packet evidence | Packet source collection, Packets 1-25 | Domain evidence, cautions and hypotheses |
| Historical contracts/design | `app/docs/*` | Rationale and implementation history; not higher product authority |
| Visual references | Design Source Pack and visual contracts | Reusable visual/interaction evidence where still useful |

## Packet coverage

The provenance packet collection covers Packets 1-25:

- 1: re-entry and missed-task recovery
- 2: delayed rewards and small progress
- 3: anti-scroll and anti-drift behaviour
- 4: right-sized tasks
- 5: flow planning
- 6: food planning and food rhythm
- 7: body and mind rhythm
- 8: work mode
- 9: retention and re-entry
- 10: safety, ethics and regulatory boundaries
- 11: executive function
- 12: task initiation, avoidance and time estimation
- 13: sleep and circadian rhythm
- 14: food rhythm and meal-planning decision fatigue
- 15: phone scrolling and digital self-regulation
- 16: household load and family disruption
- 17: money and impulsive spending
- 18: movement and physical activation
- 19: work focus, switching and re-entry
- 20: emotional regulation, shame and recovery
- 21: motivation, reward, interest, novelty and boredom
- 22: sensory load, environment, transitions and decompression
- 23: social support, accountability and co-regulation
- 24: Start Boost and anti-dopamine-hack boundaries
- 25: calendar load, fixed commitments, buffers and planning realism

The embedded packet collection contains the evidence-strengthened Packet 1 V2 PDF. The later re-entry/V3 material is represented separately by the standalone re-entry research and Project Source Additions material. Keep those layers distinct when citing historical rationale.

## Evidence weighting rule

Use the evidence source that matches the question and preserve its strength and limitations.

Research can support:

- why executive-function offloading is worth pursuing;
- why prospective-memory support, calendar context, task right-sizing, recovery, Reduced Day, rhythms and context-sensitive adaptation are useful hypotheses;
- scientific and safety boundaries;
- prototype questions and evaluation measures.

Research does **not** automatically prove that a specific Life Rhythm algorithm, screen, recurrence grammar or scheduling policy works.

Equally, lack of direct validation for a particular implementation must not be silently converted into a permanent product prohibition. Automatic private scheduling, automatic rescheduling, calendar alignment and behavioural learning are current product hypotheses explicitly authorised by `PRODUCT.md` and `MVP_PLAN.md` for bounded experimentation.

Hard scientific boundaries remain: do not use source material to claim diagnosis, treatment, clinical outcomes, measured/regulated dopamine, hidden neurological-state detection, or other physiological/clinical abilities that the product does not validly provide.

## Runtime rule

No file in `/docs` is runtime input.

Implementation changes must preserve data integrity, privacy, deterministic state validation and the true invariants in `PRODUCT.md`. Ordinary product experiments do not require a new research packet or long-form contract merely because they challenge an older product hypothesis.
