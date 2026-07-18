# Life Rhythm Documentation Authority

Status: Current repository documentation map
Date: 2026-07-19
Merged baseline branch: `main`
Merged code baseline commit: `e11d6d5022a6118f96712b48ef5776d0a6acffbd`
Latest merged visual checkpoint: PR #107, merge commit `e11d6d5022a6118f96712b48ef5776d0a6acffbd` — Visual Foundation Pass 1 / Soft Ledger shell and Pool

## Purpose

This file prevents the repository from treating historical prototype documents as current product requirements.

The current product direction is a local-first, non-clinical Life Rhythm application with a calm task-capture, safe-holding, soft-placement and re-entry loop.

## Authority order

1. **Current product authority** — `app/docs/life-rhythm-current-design-spec.md`
2. **Current boundary contracts** — applicable contracts in `app/docs/`, provided they are marked current and do not contradict the current design spec. The implemented Task Pool backup boundary is documented in `app/docs/task-pool-backup-contract.md`.
3. **Evidence and UX weighting** — `docs/ux/Life_Rhythm_Design_Specification_v1_2_Evidence_Balanced.md` and the source archive. This layer supports rationale and traceability; it does not override current runtime status or navigation.
4. **Source governance** — `app/docs/research/source-status.md`, `packet-v3-priority.md`, `research-to-mvp-map.md`, and `non-canonical-source-notes.md`.
5. **Historical plans and pre-write contracts** — documents explicitly marked historical or superseded. These preserve rationale but must not be used as current implementation status.
6. **Visual boards and source prototypes** — visual references only. They do not override the current object grammar, navigation, data boundaries or implementation contracts.

## Two application generations

| Area | Status | Authority |
| --- | --- | --- |
| Root `index.html` | Live GitHub Pages 1.4.6 legacy prototype | Protected legacy runtime; not the current `/app` architecture authority |
| `/app` | Current React/Vite/TypeScript personal-trial architecture | Current implementation path for new work |
| `/app` data | Dexie/Zod local-first persistence with user-scoped local namespaces when opt-in auth is enabled | Current data boundary |
| Cloud sync, backend, calendar writes, AI writes, import/restore execution | Not implemented | Must have a separate approved contract before work |

The root app remains live while `/app` is developed. Its older scheduling and task behaviours must not be copied into `/app` merely because they exist in the legacy runtime.

## Current `/app` product state

The merged `main` branch includes the Personal Trial v1 loop through PR #105, including the bounded PR #104 soft-placement fixes and PR #105 Task Pool backup follow-up, the PR #106 repository-guidance and documentation refresh, and the PR #107 Visual Foundation Pass 1 checkpoint, at `e11d6d5022a6118f96712b48ef5776d0a6acffbd`:

- four primary destinations: Today, Plan, Pool, Library;
- Reset and Settings as secondary shell destinations;
- settings and Life Shape persistence;
- custom Library rhythm persistence;
- active Today task and status persistence;
- Task Pool capture, safe holding, deferral and Pool-to-Today movement;
- Pool-based soft suggestions from explicit `openCapacity` blocks;
- user-confirmed local soft placements and safe removal/reconfirmation;
- linked Pool, Today and placement state updates;
- local backup export and validation previews for the currently supported data classes;
- Task Pool backup export and validation preview, including saved status and deferral metadata;
- opt-in Clerk identity shell without automatic upload or sync;
- no automatic scheduling, calendar writes, AI writes, notifications, analytics or restore/import execution.

PR #107 implements on merged `main`:

- quiet shared in-flow page headings;
- a compact shared header;
- a restrained local active-navigation marker;
- Pool as a content-led Soft Ledger / Holding Tray with ledger rows and dividers;
- a clarified Pool action hierarchy with Add to Today primary, Find soft window secondary and independent Other choices disclosures.

PR #107 is limited to visual hierarchy and action presentation: capture behaviour, action meaning and order, persistence, repositories, schemas, statuses, routes, task ordering, task lifecycle behaviour and user-confirmed placement remain unchanged. It adds no automatic scheduling, calendar writes, AI, backend, sync, notifications, analytics or restore/import behaviour. The current next bounded visual sequence is Plan card-soup and pill-chip reduction, then Today dominant-active-object refinement, with Library and Setup reserved for later passes.

## Canonical navigation and theme naming

Primary navigation is:

1. Today
2. Plan
3. Pool
4. Library

Reset and Settings are secondary destinations. They are not primary daily tabs.

Product-facing theme names remain:

- Exhale
- Clear
- Grounded

The visual token layer also contains Paper, Tide, Clay and Night. Exhale maps to Paper, Clear maps to Tide, and Grounded maps to Clay. Night is a token foundation only and is not exposed by the current product selector.

## Source archive status

The supplied `Life_Rhythm_All_Project_Sources_2026-07-12.zip` is the current provenance bundle for source review. It contains:

- the extracted Design Source Pack v1.2;
- the packet source collection covering Packets 1-25;
- the project-source governance additions;
- current research/design documents, handovers and visual review references;
- the extracted `/app` preview build.

The embedded packet collection's Packet 1 file is the evidence-strengthened V2 packet. The standalone `Re-entry and Missed-Task Recovery in Adult ADHD for Life Rhythm` research document and the project-source additions provide the current re-entry/V3 governance direction. These are related source layers, not interchangeable filenames.

The source archive is provenance material. It is not loaded by the runtime and is not a substitute for updating the repository's current design spec.

## Backup disclosure

Current backup exports are data-class-specific. Settings, custom Library rhythms, active Today tasks, soft placements, and Task Pool items have separate export/check paths.

Task Pool backup includes saved Pool rows, their status, useful-window fields, and `bringBackAfter` deferral metadata. It does not include settings, Today tasks, Library rhythms, soft placements, calendar data, scheduler output, or restore/import execution. Backup checking remains read-only.

## Verification policy

- `npm run build` must pass for `/app`.
- Tests involving local dates and ISO timestamps must be timezone-deterministic; they must not assume that a `Z` timestamp represents local wall-clock time.
- Automated tests do not replace a mobile, desktop and keyboard walkthrough.
- A future PR that changes implementation status must update this authority map and the current design spec in the same PR.
