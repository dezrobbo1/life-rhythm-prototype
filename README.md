# Life Rhythm Prototype

Life Rhythm is a local-first prototype for testing ADHD-friendly rhythm support, task initiation, re-entry after missed tasks, realistic time planning and daily routine scaffolding.

Current version in this repository: **Prototype 1.3.5**.

## What is included

- `index.html` — the current single-file Life Rhythm prototype.
- `manifest.json` — PWA metadata for Home Screen installation.
- `service-worker.js` — basic offline cache for the app shell.
- `icons/icon.svg` — temporary app icon.
- `.nojekyll` — prevents GitHub Pages from applying Jekyll processing.

## Testing on iPhone

1. Enable GitHub Pages for this repository.
2. Open the GitHub Pages URL in Safari on iPhone.
3. Tap **Share**.
4. Tap **Add to Home Screen**.
5. Open Life Rhythm from the new Home Screen icon.

## Data warning

This prototype stores data locally in the browser/app storage on the device. Export JSON backups regularly, especially before clearing Safari data, changing phones, deleting the Home Screen app, or testing major changes.

## Non-clinical boundary

Life Rhythm is not a medical device, diagnostic tool, treatment, therapy, coaching service, exercise prescription, nutrition plan, financial advice tool or crisis support tool. It is a self-management prototype for personal testing.

## Version notes — 1.3.5

Prototype 1.3.5 added task timing and actual-time calibration:

- Start timers for tasks.
- Pause, resume, cancel and finish timed sessions.
- Compare planned time with actual time.
- Store timing history locally.
- Show timing insights and average actual duration.

It retains:

- Minimum / Normal / Full for flexible tasks.
- Must-finish and checkpoint task types.
- Reset Today.
- Late-window handling.
- Tomorrow Review.
- Time Reality Layer.
- Local export/import.
