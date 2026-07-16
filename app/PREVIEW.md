# Life Rhythm /app preview

This preview path is for reviewing the current React/Vite Personal Trial v1 slice. It does not replace the live root Life Rhythm 1.4.6 GitHub Pages app at:

https://dezrobbo1.github.io/life-rhythm-prototype/

## What the workflow does

The `App Preview (/app)` workflow:

- installs dependencies inside `/app`
- runs `npm test`
- runs `npm run build -- --base=./`
- uploads `/app/dist` as the `life-rhythm-app-preview-dist` workflow artifact
- publishes `/app/dist` to the separate `gh-pages-app-preview` branch when run from `main`

The preview branch is separate from the root production Pages source. Do not change the repository Pages source to `gh-pages-app-preview` unless you intentionally want to stop serving the root 1.4.6 app.

## How to trigger it

1. Open the GitHub repository.
2. Go to **Actions**.
3. Select **App Preview (/app)**.
4. Choose **Run workflow**.
5. Select the `main` branch if you want the preview branch updated.

The workflow also runs on pull requests that touch `/app` or the workflow file, but pull request runs only build/test/upload the artifact. They do not publish the preview branch.

## Where to find the preview output

After the workflow finishes:

- Download the artifact from the workflow run: `life-rhythm-app-preview-dist`
- View the generated preview branch: `gh-pages-app-preview`

Expected branch location:

https://github.com/dezrobbo1/life-rhythm-prototype/tree/gh-pages-app-preview

GitHub Pages only serves one branch/source for a repository at a time, so the separate preview branch is intentionally not wired as the live Pages source.

## iPhone review options

Safe options that do not replace the root app:

1. Use the workflow artifact and serve the unzipped `dist` folder from a local machine on the same Wi-Fi network.
2. Run the React app locally on the LAN:

```bash
cd app
npm ci
npm run dev -- --host 0.0.0.0
```

Then find the computer's local IP address and open this on the iPhone while it is on the same Wi-Fi network:

```text
http://YOUR_LOCAL_IP:5173
```

This is the easiest phone-review URL without changing the production GitHub Pages source.
