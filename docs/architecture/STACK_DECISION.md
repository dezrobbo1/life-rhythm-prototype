# Stack decision

Status: Current architecture decision for `/app`.

The repository contains two generations: the protected root 1.4.6 single-file PWA and the newer `/app` local-first architecture. The root app remains live; new product work belongs in `/app`.

Recommended stack:

- Vite
- React
- TypeScript
- IndexedDB with Dexie
- Zod for validation and migrations
- CSS variables for themes
- GitHub Pages for deployment

Current implementation also includes an opt-in Clerk identity shell and user-scoped local Dexie namespaces. Identity does not imply upload or sync.

Do not add a backend data store, cloud sync, analytics, default calendar integration, calendar writes, AI writes, notifications, or native wrapper at this stage. Any future data movement or visibility change requires a separate contract and privacy review.

The current 1.4.6 app should remain stable while `/app` is validated on its own preview path. `/app` is no longer scaffold-only: it contains the Personal Trial v1 capture, holding, soft-placement and re-entry slice, with repeating rhythm instances and broader resurfacing still deferred.
