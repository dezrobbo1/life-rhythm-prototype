# Life Rhythm app scaffold

This folder is the future Vite + React + TypeScript architecture scaffold for Life Rhythm.

It does not replace the current root `index.html`, `manifest.json`, or `service-worker.js` app. The live 1.4.6 GitHub Pages PWA remains served from the repository root.

## Scope

- Placeholder app shell only.
- Placeholder screens: Today, Plan, Library, Reset, Setup.
- CSS-variable theme tokens for Exhale, Clear, and Grounded.
- Component, data, and domain folders ready for later migration.
- Zod schemas, Dexie table definitions, import/export validators, and read-only `lifeRhythm_v146` migration inspection.
- No data migration, no backend, no accounts, no cloud sync, no analytics, no calendar integration, and no notifications.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

Later phases can port behavior into this scaffold after the root 1.4.6 app remains stable and migration gates are explicitly approved.
