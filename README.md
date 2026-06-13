# Life Rhythm Prototype

Life Rhythm is a local-first prototype for testing ADHD-friendly rhythm support, task initiation, re-entry after missed tasks, realistic time planning and daily routine scaffolding.

Current version in this repository: **Prototype 1.3.6**.

## What is included

- `index.html` — small PWA entry point.
- `styles.css` — shared visual styling.
- `app.js` — main app logic.
- `manifest.json` — PWA metadata for Home Screen installation.
- `service-worker.js` — basic offline cache for the app shell.
- `icons/icon.svg` — temporary app icon.
- `.nojekyll` — prevents GitHub Pages from applying Jekyll processing.

## Why it is now modular

The prototype started as a single HTML file for fast iPhone testing. It is now split into HTML, CSS and JavaScript so future changes are easier to review, test and improve without editing one large file.

This gives more flexibility for:

- separate UI and logic changes
- cleaner version control
- easier debugging
- future tests
- future component refactoring
- possible migration to a fuller PWA framework later

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

## Version notes — 1.3.6

Prototype 1.3.6 adds Start Boost as a behavioural task-initiation layer:

- Start Boost is now inside the task-start flow.
- Tasks include barrier selection, such as too big, unclear first step, low energy, emotionally hard or pulled to phone.
- Start Boost suggestions are task-sensitive.
- Timed sessions can record the Start Boost used.
- The app asks whether the Start Boost helped.
- Timing Insights now includes Start Boost history.
- Setup includes safety exclusions for food rewards, shopping rewards, scrolling rewards, urgency countdowns, accountability prompts and streak pressure.
- Wording avoids dopamine-hacking, dopamine-reset or brain-chemistry claims.

It retains:

- local-first storage
- task timing
- planned versus actual time comparison
- Minimum / Normal / Full task completion
- Reset Today
- Not Now parking
- JSON export/import
