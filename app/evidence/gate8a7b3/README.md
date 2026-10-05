# Gate 8A7B3 reproducible cloud-browser evidence

This is bounded completion and confirmed-review correction evidence for open PR #175. `replay.cjs` runs the seven completion rows plus the focused Plan correction failure/focus matrix and exits nonzero on a failed assertion. It launches its own loopback Vite server and uses new isolated Chromium contexts containing only synthetic data. It never opens an owner profile, hosted account, provider, or external URL.

The original broad-reviewed application commit is `b1ae38bc56bf6f1205e9163fa3c3e81536cd753d`. The correction continues exact head `aaa0a31ae26fd2e174ef45b780df553698f6d3a4`, which already contains policy main/base `c2ee838163497938e84b0a2044f3dc4ad961c2b6`. The corrected application differs from the original; `manifest.json` records its exact `app/src` tree and runtime paths/bytes SHA-256, alongside the prior source attribution. The harness refuses a fingerprint mismatch before browser writes. `pre-correction-row-results.json` preserves the previous seven-row evidence; `row-results.json` is the fresh corrected-source replay. The correction report and PR metadata identify publication and remaining independent verification.

## Run from a clean checkout

From `app`, install the lockfile dependencies and build if this checkout does not already have an attributable build:

```sh
npm ci
npm run build
```

Use Playwright 1.62.1 and Chromium. The checked cloud runtime already exposes Playwright through `NODE_PATH` and has `/usr/bin/chromium` 151.0.7922.173. If absent, install Playwright in an isolated temporary tooling directory rather than changing application dependencies:

```sh
npm install --prefix /tmp/life-rhythm-b3-tooling --no-save playwright@1.62.1
```

From repository root, when using that isolated installation:

```sh
NODE_PATH=/tmp/life-rhythm-b3-tooling/node_modules B3_CHROMIUM=/usr/bin/chromium node app/evidence/gate8a7b3/replay.cjs
```

Or, with Playwright already available:

```sh
node app/evidence/gate8a7b3/replay.cjs
```

Set `B3_CHROMIUM` to a valid Chromium executable on another platform. `B3_PORT` changes the private loopback port (default 5187); `B3_OUTPUT` changes the local output directory (default `/tmp/life-rhythm-b3-replay`). `B3_ROWS` optionally selects comma-separated exact row names for failure diagnosis; omit it for the complete eight-row evidence run. Do not claim a filtered run covers omitted rows.

The harness starts and stops its own server. It records the executing checkout commit, the fixed reviewed source commit, current runtime fingerprint and source tree, browser and Playwright versions, viewport per row, timezone, advancing-clock rule, assertions/results, runtime page errors, and screenshot hashes in `row-results.json` under the output directory. Screenshots and generated build output stay local. The server serves the fingerprinted Vite source; the recorded `builtFiles` are hashes of the separately validated local build, not a claim that the browser visited a production preview. If no `dist` exists, `builtFiles` is null.

## Covered assertions

- Focused Plan matrix at 390×844: first automatic Protect replacement focus; existing corrected Protect/Unprotect with an explicit stable destination; same-day Move replacement focus; cross-day Move to Plan details; subsequent date navigation without stale focus theft; synthetic invalid-calendar read failure while corrected manual placements remain readable; saved title/time fallback with byte-identical persistence snapshots during inspection; successful read restores deduplication. Fixture corruption and removal are explicit harness writes; inspection and no-write comparisons begin after the fixture change. The existing rhythm row retains Move conflict/cancel/no-write, keyboard trap, same-day success, Protect/Unprotect, Why and reload checks.

- Mobile 390×844 and desktop 1280×844: long Task title (209 characters) and authored Minimum (195 characters), focused input, visible keyboard outline, reachable Save/Cancel after modal scrolling, Tab/Shift+Tab containment, Enter/Space activation, Cancel/no write, Save/status preservation, return to opener, reload persistence, and no document overflow.
- Contextual rhythm correction at 390×844: conflict feedback inside the modal, rejected Move and Cancel/no write, local start correction, original duration and linked identity, successful-row focus, Protect/Unprotect, grounded Why, reload, and overflow.
- Reduced Day at 390×844: establish a normal private plan before preview, preview/no write, trap/Escape/opener return, apply/genuine Changed, exactly one eligible Undo, placements and day mode restored together, Undo/reload, Return to normal/reload. This fixture intentionally contains no rhythms; the dedicated rhythm row covers their correction without background occurrence-materialization races contaminating the preview baseline.
- Relief at 390×844: zero and multiple-task cases, restart preview/no write, Narrow Today to `notToday`, Park extras to `parked`, no deletion, resulting one-task preview/no write and harmless no-op relief, reload, unsupported controls absent, and overflow.

## Earlier evidence and attribution

`prior-results.json` preserves the original successful cloud-browser observations at the reviewed application commit. `prior-replay.cjs` preserves that executed replay with output-path, loopback URL, and executable-path portability adjustments plus one corrected observation label: the old summary overstated generated-rhythm execution, while the actual clicked task was ad-hoc. Rhythm linked execution remains automated/B2 evidence; it is not a browser execution PASS. `node --check` validates those adjustments; the original complete browser sequence was not rerun for this completion pass. For independent reproduction of earlier rows, start `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` from `app`, then run `node app/evidence/gate8a7b3/prior-replay.cjs` from repository root. `B3_ORIGIN` may specify another loopback Vite port. Never point this fixture at a production profile. Its throwaway portable-export JSON must remain local.

The earlier replay covers populated Today/Later; Capture/save/reload; task Move conflict/save/Protect/Unprotect/Why; Minimum/continuation/pause/resume; Reduced Day; Relief preview/history disclosure; dated re-entry; rhythm configuration; seven-day planning controls; portable export and file check. The fresh independent engineering reviewer independently checked the task/Capture/lifecycle/correction/disclosure rows at 390×844 on the same application commit and returned MERGE with no confirmed findings (task `01a10c81-9d18-71f3-a0ea-cc2ecc2fa03a`). The new seven-row run completes its identified gaps; parent requests targeted evidence verification afterward.

`manifest.json` lists the 14 original supporting screenshot filenames/hashes. `row-results.json` lists completion screenshots. These screenshot bytes are **not remotely delivered**: the ZIP's Library upload and one bounded retry both failed at tool discovery before upload preparation. The executable source replay and recorded assertion results are the durable evidence route. Hashes identify local supporting images; they do not make them accessible to another executor.

Original immutable preview: `https://life-rhythm-prototype-5yyl73gl8-daler-project-lr.vercel.app`, deployment `dpl_BxKjBdhyptWncbFhoUchkzf1Fyqp`, READY metadata attributes original reviewed head. Hosted navigation failed at the cloud proxy with `net::ERR_TUNNEL_CONNECTION_FAILED` before rendering. Local source/browser evidence does not claim hosted interaction was verified.

Ordinary intermediate acceptance follows the merged [MVP evidence policy](../../../MVP_PLAN.md#acceptance-evidence-policy). It does not fabricate physical-device or owner subjective PASS, close #168/#160, grant integrated Gate 8A8 PASS, start 8B, or authorize a merge in this cloud task. Final integrated owner-trial judgment, account/provider authorization and true manual gates remain. No specific remaining B3 device-only failure was identified in these checks; the cloud did not emulate an operating-system software keyboard.
