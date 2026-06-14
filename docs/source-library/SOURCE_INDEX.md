# Source index

This index records the current evidence and design source library for Life Rhythm.

## Current consolidated research source

- `Life_Rhythm_Packet_Source_Collection.zip`

This archive is the consolidated source packet library used to support the design work. It is evidence reference material only and is not loaded by the app runtime.

## Current design source pack

- `Life_Rhythm_Design_Source_Pack_v1_2.zip`

This archive contains the design documentation and design board source set used during the v1.2 evidence-balanced design pass.

## Current implementation reference

The implementation reference is stored as Markdown under:

- `/docs/ux/Life_Rhythm_Design_Specification_v1_2_Evidence_Balanced.md`

## Evidence weighting rule

Use the packet that matches the feature. Packets 22 and 25 are global constraints only:

- Packet 22: sensory, visual, interruption and environmental load.
- Packet 25: fixed commitments, hidden edges, buffers and soft planning.

Do not use Packets 22 or 25 as substitute evidence for re-entry, task initiation, Start Boost, reset, food, sleep, money, movement, household, work, emotional recovery or social support features.

## Runtime rule

No file in `/docs` should be imported by the production app.
