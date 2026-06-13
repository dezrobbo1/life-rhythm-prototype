# Life Rhythm Prototype

Life Rhythm is a local-first prototype for testing ADHD-friendly rhythm support, task initiation, re-entry after missed tasks, realistic time planning and daily routine scaffolding.

Current version in this repository: **Prototype 1.4.0 deployment shell**.

## Active deployable app

The active deployable app is `index.html`. It currently contains the full phone-trial prototype UI and logic inline so it can be deployed directly by Netlify, Vercel or GitHub Pages without a build step.

## What is included

- `index.html` — deployable prototype shell.
- `manifest.json` — PWA metadata for Home Screen installation.
- `service-worker.js` — offline cache with network-first navigation so new deployments replace stale cached builds.
- `icons/icon.svg` — temporary app icon.
- `.nojekyll` — prevents GitHub Pages from applying Jekyll processing.
- `styles.css` and `app.js` — older modular prototype files retained for reference only; the active deployable app is `index.html`.

## Prototype capabilities

The current deployable prototype includes:

- Today-first start screen.
- Current block / work-time awareness.
- “How today feels” state selection.
- Top 3 next actions.
- Minimum / Normal / Full task completion.
- Soft daily schedule by rhythm block.
- Tomorrow review and daily review.
- Reset Today, shrink tasks, move extras, restart with one action, and clear today state.
- Task creation, editing, deletion and starter tasks.
- Standard task library and quick packs.
- Start Boost supports for task initiation, with safety exclusions.
- Task timer and planned-versus-actual timing history.
- Local storage, JSON export and JSON import.
- PWA manifest and offline service worker.

## Deployment note

The previous service worker used a cache-first pattern. That could keep serving an older or less functional build after Netlify/GitHub had already deployed newer files. `service-worker.js` now uses network-first navigation for HTML and bumps the cache to `life-rhythm-prototype-1-4-0-v1` so stale caches are cleared on activation.

If an older version is still visible on iPhone after deployment, refresh once, then close and reopen the Home Screen app. If Safari still holds the old app shell, remove the Home Screen icon and add it again from the deployed URL.

## Testing on iPhone

1. Deploy the repository through Netlify, Vercel or GitHub Pages.
2. Open the deployed URL in Safari on iPhone.
3. Confirm the app title/date line shows the current prototype rather than an older cached version.
4. Tap **Share**.
5. Tap **Add to Home Screen**.
6. Open Life Rhythm from the new Home Screen icon.

## Data warning

This prototype stores data locally in the browser/app storage on the device. Export JSON backups regularly, especially before clearing Safari data, changing phones, deleting the Home Screen app, or testing major changes.

## Non-clinical boundary

Life Rhythm is not a medical device, diagnostic tool, treatment, therapy, coaching service, exercise prescription, nutrition plan, financial advice tool or crisis support tool. It is a self-management prototype for personal testing.
