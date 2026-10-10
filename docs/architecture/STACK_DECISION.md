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

Historical merged implementation includes an opt-in Clerk shell/local namespaces. Owner-approved unmerged C1 PR #180 replaces the provider with Supabase Auth and a same-origin Vercel API to a dedicated metadata schema. Personal data remain device-only; C2/C3 are later work. See the [current C1 contract](../../app/docs/gate8a7c1-account-boundary-contract.md).

Beyond the approved metadata-only C1 boundary, do not add cloud sync, analytics, default calendar integration, calendar writes, AI writes, notifications, or native wrapper at this stage. Any future data movement or visibility change requires a separate contract and privacy review.

The current 1.4.6 app should remain stable while `/app` is validated on its own preview path. `/app` is no longer scaffold-only: it contains the Personal Trial v1 capture, holding, soft-placement and re-entry slice, with repeating rhythm instances and broader resurfacing still deferred.
