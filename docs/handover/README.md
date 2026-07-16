# Life Rhythm handover

Use this folder for continuity notes between research, design, implementation and Codex work.

## Current status

- Root `index.html` remains the protected public 1.4.6 legacy PWA.
- `/app` is the current React/Vite/TypeScript local-first Personal Trial v1 architecture.
- Current branch: `main`, code baseline `553b83f` after PR #105 merge.
- Current product authority: `app/docs/life-rhythm-current-design-spec.md`.
- Current documentation map: `docs/DOCUMENTATION_AUTHORITY.md`.
- Current source provenance bundle: `Life_Rhythm_All_Project_Sources_2026-07-12.zip` supplied for the 2026-07-12 consolidation.

## Current implementation rule

Do not rewrite the live 1.4.6 app in place. New work belongs in `/app` and must preserve local-first, non-clinical, user-confirmed and no-calendar-write boundaries.

The current `/app` loop includes Today, Plan, Pool and Library, Pool capture/holding, Pool-based open-capacity suggestions, user-confirmed soft placement, data-class-specific backup export/check paths including Task Pool status and deferral metadata, and local persistence for approved data classes. PR #105 is merged. The next work is fresh visual/product validation followed by bounded Pool, Plan and Today hierarchy refinement. Repeating rhythm instances, broader resurfacing, `askFirst` placement, calendar integration, AI, sync, notifications and restore/import execution remain future work.

## Evidence rule

Use the feature-specific packet anchors in the v1.2 evidence-balanced design spec. Packets 22 and 25 are global constraints, not default evidence for every feature.
