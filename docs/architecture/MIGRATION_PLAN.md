# Migration plan

This plan moves Life Rhythm from the current single-file 1.4.6 prototype toward a maintainable local-first PWA architecture without breaking the live app.

Status: Migration plan retained as a staged history and boundary reference. The `/app` implementation has progressed beyond the scaffold and early read-only phases. Current status is governed by `docs/DOCUMENTATION_AUTHORITY.md` and `app/docs/life-rhythm-current-design-spec.md`.

## Migration principle

Do not rewrite the live 1.4.6 app in place. Build the new architecture on a controlled branch and keep the existing runtime stable until the new shell passes QA.

## Historical recommended branch

`architecture/vite-react-pwa`

That branch recommendation is historical. The active architecture now lives in `/app`; the root 1.4.6 runtime remains protected and live.

## Phase 1 - scaffold only (complete)

- Add Vite, React and TypeScript.
- Add app shell structure.
- Add placeholder screens: Today, Plan, Library, Reset, Setup.
- Add theme-token files for Exhale, Clear and Grounded.
- Add component folders for cards, buttons, chips, modals, empty states and app shell.
- Do not port behaviour yet.
- Do not migrate data yet.

## Phase 2 - data layer (substantially complete for approved data classes)

- Add IndexedDB via Dexie.
- Add Zod schemas for settings, rhythms, active tasks, completion logs, Start Boost logs, reset logs and dev tickets.
- Add read-only migration inspection from `lifeRhythm_v146`.
- Keep old localStorage keys untouched.

## Phase 3 - core screens (substantially complete for the Personal Trial v1 slice)

- Port Today, Task Card and Start Boost first.
- Preserve library-first task behaviour.
- Preserve non-clinical wording.
- Preserve no task flooding.

## Phase 4 - rhythm and recovery screens (substantially complete for the current slice)

- Port Plan, Library and Reset.
- Keep Plan as a soft scaffold, not a calendar.
- Keep Reset as relief, not failure.
- Keep Library as a rhythm catalogue, not a task inbox.

## Phase 5 - setup and tools (partially complete)

- Port Setup.
- Port Add/Edit Task.
- Port Dev Tickets.
- Add import/export validation.
- Add full-reset safeguards.

## Phase 6 - QA and deployment (ongoing)

- Run unit and browser tests.
- Confirm existing 1.4.6 behaviour is not broken until replacement is intentional.
- Bump version only when ready to publish the new app shell.
- Confirm GitHub Pages base path works.
- Confirm PWA cache uses a new versioned cache name.

The current `/app` preview requires its own build/test and mobile/desktop/keyboard walkthrough. It is not the root GitHub Pages source.

## Stop conditions

Stop and review before continuing if:

- the new scaffold requires deleting current runtime files;
- the data migration would alter old localStorage keys;
- Today begins showing library templates as active tasks;
- quick packs create a task pile;
- the design spec is contradicted by implementation convenience;
- a backend, account system, analytics or default calendar integration becomes necessary.
