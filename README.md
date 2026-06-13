# Life Rhythm Prototype

Current deployable version: 1.4.3.

Life Rhythm is a local-first, non-clinical self-management prototype for daily rhythm, task initiation, realistic time planning, and reset/re-entry after disrupted days.

## Active app

The live GitHub Pages app is the root `index.html`. It is a single-file app shell with embedded CSS and JavaScript, adapted from `local_generated_builds/index_v141.html` in the handover pack and versioned as 1.4.3.

The older modular `app.js` and `styles.css` files are not part of the live app path.

## GitHub Pages

- Deploy from `main` and the repository root.
- Preview URL: `https://dezrobbo1.github.io/life-rhythm-prototype/`
- The app uses relative paths so it works under the `/life-rhythm-prototype/` project path.
- `manifest.json` supports Home Screen installation.
- `service-worker.js` caches the 1.4.3 single-file shell, manifest, and icon.

If Safari or a Home Screen install shows an older version, refresh once, close and reopen the app, or remove and re-add the Home Screen icon.

## Testing checklist

- Open the GitHub Pages URL on desktop and iPhone Safari.
- Confirm the title/version line shows 1.4.3.
- Test bottom navigation: Today, Plan, Reset, Tasks, Setup.
- Add, edit, delete, complete, shrink, park, and move tasks.
- Test Reset actions: Too much today, move extras, restart with one action.
- Test Start Boost selection and feedback.
- Start, pause, cancel, and finish timers.
- Export JSON, then import it again and confirm data restores.
- Confirm local storage persists after reload.
- Confirm mobile layout does not clip the bottom navigation or modal controls.

## Data and safety boundary

Life Rhythm stores data locally in the browser. There is no backend, account, or cloud sync. Export JSON backups before clearing browser data, replacing a device, or reinstalling the Home Screen app.

Life Rhythm is not a medical device, diagnostic tool, treatment, therapy, coaching service, exercise prescription, nutrition plan, financial advice tool, or crisis-support tool.
