# Life Rhythm source index

Status: Current source map
Date: 2026-07-12

This index records the source material used to guide Life Rhythm. It is evidence and provenance material, not runtime input.

## Repository authority

The current implementation and documentation hierarchy are defined in:

- `../DOCUMENTATION_AUTHORITY.md`
- `../../app/docs/life-rhythm-current-design-spec.md`

The current design spec governs product direction and implementation status. Source documents can support rationale, safety boundaries and design hypotheses, but cannot silently expand product scope.

## Current provenance bundle

The supplied source bundle is:

- `Life_Rhythm_All_Project_Sources_2026-07-12.zip`

The bundle is external provenance material supplied for the 2026-07-12 consolidation. It contains the extracted Design Source Pack v1.2, the Packet 1-25 source collection, project-source governance additions, primary research/design documents, handovers, text derivatives, visual review references and the current `/app` preview build.

The bundle is not loaded by the app runtime and is not a substitute for the repository's current design documents.

## Active source layers

| Layer | Current source | Use |
| --- | --- | --- |
| Product authority | `app/docs/life-rhythm-current-design-spec.md` | Current product identity, boundaries, implementation state and roadmap |
| Evidence-balanced UX | `docs/ux/Life_Rhythm_Design_Specification_v1_2_Evidence_Balanced.md` | Packet weighting, screen responsibilities and non-clinical UX guardrails |
| Design source pack | Design Source Pack v1.2 in the consolidated bundle | Visual boards and evidence-to-design traceability; visual reference only |
| Packet evidence | Packet source collection, Packets 1-25 | Evidence context and domain-specific cautions |
| Source governance | `app/docs/research/` and Project Source Additions v1.0 in the bundle | Canonical/provisional/source-only/quarantined classification |
| Current visual contracts | `app/docs/visual-design-direction-contract.md`, `object-grammar-spec.md`, `navigation-redesign-contract.md`, `theme-system-contract.md` | Current visual and interaction implementation boundaries |

## Packet coverage

The active packet collection covers Packets 1-25:

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
- 25: calendar load, fixed commitments, buffers and soft planning

The embedded packet collection contains the evidence-strengthened Packet 1 V2 PDF. The current re-entry/V3 governance direction is represented separately by the standalone `Re-entry and Missed-Task Recovery in Adult ADHD for Life Rhythm` document and the Project Source Additions material in the consolidated bundle. These source layers must not be conflated.

## Evidence weighting rule

Use the packet that matches the feature. Packets 22 and 25 are global guardrails for sensory/visual/interruption load and calendar/load realism; they are not default evidence for every screen.

Do not use source packets to justify:

- diagnosis, treatment or clinical outcome claims;
- automatic scheduling or calendar write-back;
- AI authority or AI-written state;
- financial, nutrition, exercise or crisis-support advice;
- surveillance, adherence scoring, streak pressure or public accountability.

## Runtime rule

No file in `/docs` should be imported by the production app. Research and design documents must be translated into an approved contract or current design-spec change before implementation.
