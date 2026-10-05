# Gate 8A7B3 reproducible cloud-browser evidence

The current replay/manifest includes the narrow post-merge correction for [the late #175 focus finding](https://github.com/dezrobbo1/life-rhythm-prototype/pull/175#discussion_r4186367782). See [correction report](../../docs/plan-correction-focus-report.md), [red-first evidence](post-merge-focus-red.json) and [first-publication scoped results](post-merge-focus-results.json). The current application tree/fingerprint is in `manifest.json`. That first-publication run covers **11 affected rows**, not the unrelated completion rows. It uses isolated Chromium contexts and synthetic data only.

The original `prior-results.json`, `pre-correction-row-results.json` and accepted pre-merge `row-results.json` remain dated evidence on their embedded source identifiers. Their outcomes have not been relabelled or rerun as a broad acceptance review. Manifest fields `acceptedPrePostMergeApplicationSourceTree` and `acceptedPrePostMergeRuntimeSourceSha256` retain the accepted pre-merge source identity. `prior-replay.cjs` remains the historical replay. Screenshots remain local and are not remotely delivered.

The latest consolidated lifecycle pass continues PR #178 after its pending-Move input finding. [Lifecycle red evidence](focus-lifecycle-red.json) and [lifecycle results](focus-lifecycle-results.json) identify the current matrix; `post-merge-focus-results.json` is preserved first-publication evidence. The manifest's `focusLifecycleReviewedHead` and prior-post-merge source fields distinguish the generations. Run **only the 42 affected focus rows** with:

```sh
B3_FOCUS_ONLY=1 B3_OUTPUT=/tmp/life-rhythm-focus-lifecycle node app/evidence/gate8a7b3/replay.cjs
```

The 31 added lifecycle rows cover 24 Move combinations (Tab/click × immediate/delayed/missing successor × same/cross day × replaced/stable ID), two rejected Move cases, four pending within-correction Protect/Unprotect cases, and the pending Move keyboard case at desktop width. They hold UI result delivery after the real Move coordinator completes. For Protect/Unprotect, they hold command start until the pending disclosure input occurs, then run the real command. All use real React/IndexedDB and independently controlled Day Line delivery. This tests asynchronous ownership, connected return, cancellation and unchanged persisted authority without relying on arbitrary focus timing.

For the nine new ordering rows, the replay intercepts only the compiled `PlanDayLineScreen` subscriber `next` callback at the loopback browser route. It holds real read results or supplies synthetic loading/error delivery, then explicitly releases the latest result. React mounts/commits, correction coordinators and IndexedDB remain real. This fixture does not change application source or scheduler/storage semantics. The immediate-successor, same/cross-day Move, rhythm and conflict/cancel regressions use the existing uninstrumented rows. Results state the instrumentation; no hosted-deployment or physical-device check is claimed.

Run the exact affected scope from repository root:

```sh
B3_ROWS=contextual-rhythm-correction,plan-correction-failure-and-focus,plan-ordering-protect-delayed,plan-ordering-protect-error,plan-ordering-protect-loading,plan-ordering-protect-keyboard,plan-ordering-protect-pointer,plan-ordering-protect-date,plan-ordering-unprotect-error,plan-ordering-move-delayed,plan-ordering-protect-desktop B3_OUTPUT=/tmp/life-rhythm-focus-replay node app/evidence/gate8a7b3/replay.cjs
```

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

Set `B3_CHROMIUM` to a valid Chromium executable on another platform. `B3_PORT` changes the private loopback port (default 5187); `B3_OUTPUT` changes the local output directory (default `/tmp/life-rhythm-b3-replay`). `B3_ROWS` optionally selects comma-separated exact row names for failure diagnosis; omit it for all 48 available rows. A filtered run covers only its named rows. Do not claim a filtered run covers omitted rows.

The harness starts and stops its own server. It records the executing checkout commit, the fixed reviewed source commit, current runtime fingerprint and source tree, browser and Playwright versions, viewport per row, timezone, advancing-clock rule, assertions/results, runtime page errors, and screenshot hashes in `row-results.json` under the output directory. Screenshots and generated build output stay local. The server serves the fingerprinted Vite source; the recorded `builtFiles` are hashes of the separately validated local build, not a claim that the browser visited a production preview. If no `dist` exists, `builtFiles` is null.

## Available assertions (historical completion plus current ordering scope)

- New ordering matrix: missing/delayed/loading/error successors use connected Plan details; released successors regain focus only before keyboard/pointer/date navigation cancels the request. Protect/Unprotect and same-day Move retain saved correction lifecycle, and focus/inspection/release do not write the compared persistence tables. Mobile 390×844 plus desktop 1280×844.

- Existing focused Plan matrix at 390×844: first automatic Protect replacement focus; existing corrected Protect/Unprotect with an explicit stable destination; same-day Move replacement focus; cross-day Move to Plan details; subsequent date navigation without stale focus theft; synthetic invalid-calendar read failure while corrected manual placements remain readable; saved title/time fallback with byte-identical persistence snapshots during inspection; successful read restores deduplication. Fixture corruption and removal are explicit harness writes; inspection and no-write comparisons begin after the fixture change. The existing rhythm row retains Move conflict/cancel/no-write, keyboard trap, same-day success, Protect/Unprotect, Why and reload checks.

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
