# Stack decision

Life Rhythm should move from the current single-file prototype toward a local-first PWA architecture.

Recommended stack:

- Vite
- React
- TypeScript
- IndexedDB with Dexie
- Zod for validation and migrations
- CSS variables for themes
- GitHub Pages for deployment

Do not add a backend, accounts, cloud sync, analytics, default calendar integration or native wrapper at this stage.

The current 1.4.6 app should remain stable while the new architecture is scaffolded on a controlled migration branch.
