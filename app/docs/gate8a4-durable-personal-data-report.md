# Gate 8A4 — durable personal data v0 implementation report

Base `main`: `697860427cab5008c3c13ef50b4c7201f560932a`, the merge of PR #162. Gate 8A3 is complete. This Gate 8A4 implementation is an open PR pending review and merge. Gate 8A5 and Gate 8B have not started; issue #160 remains open for Gate 8A8 narrow/mobile acceptance.

## Recovery authority

The [canonical class inventory](gate8a4-durable-personal-data-contract.md) records every v6 Dexie store and settings sidecar. A single strict `life-rhythm-portable-profile-backup` format v1 carries combined reviewed settings, explicit preferences, Gate 7E duration controls, rhythm templates/plans/revisions/instances, Today tasks, Task Pool, confirmed placements, trusted Gate 7 factual behaviour events and the static `.ics` source with authored buffers. It excludes auth identity/secrets, development records, legacy operational logs and the derived private scheduler plan. Existing narrow backup/check formats retain their previous authority. The app version is informational; format version governs compatibility.

Export reads the active local namespace in a read transaction and fails on invalid canonical rows or unreadable history. Check is read-only and validates strict classes, IDs, rhythm relationships and current bounded calendar authority before summarizing counts. Malformed/future formats fail closed. Missing singletons in the checked artifact delete corresponding destination state on restore. Unreadable legacy or current destination authority is not erased silently.

Conflict policy is **replace the current local profile**, with no merge or timestamp election. A non-empty destination requires typing `REPLACE LOCAL PROFILE`. The preview expectation compares all affected rows, the derived plan and the destination namespace inside the restore transaction; any change requires checking again. The restore clears affected canonical tables and stale scheduler plan, then writes the validated artifact in one Dexie transaction. A mid-write failure rolls the transaction back. On success the browser reloads, and a fresh private plan builds from restored settings, calendar, preferences and duration controls. Neither export nor restore connects to a provider or uploads personal data.

## Recovery evidence

The representative namespace A fixture includes reviewed settings, one Task Pool item, Today task, placement, configured rhythm, plan, recurrence revision and instance, explicit preference, duration override, trusted behaviour event and calendar source with buffers. Export A → check/restore into empty namespace B → normal repository reads and live scheduler context → export B produces the same canonical payload (excluding regenerated export metadata); A remains unchanged. The restored scheduler has no copied accepted plan and rebuilds successfully. A checked preview from empty B cannot be used in another empty namespace. Other signed-in and legacy namespaces remain unchanged.

Further tests cover confirmed non-empty replacement, cleared stale singletons, changed destination, failed mid-transaction write, unsupported version, unknown class, duplicate IDs, broken rhythm references, archived historical references and duration controls, invalid duration/behaviour sidecars, over-budget calendar, selected JSON files and confirmation UI. Existing Gate 8A3 calendar safety and class-specific backup tests remain in the matrix.

## Validation on final source tree

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed |
| Focused UTC and Perth recovery, calendar, scheduler and backup matrix | 23 files / 415 tests passed in each timezone |
| Full `TZ=UTC npm test -- --run` | 107 files / 1,258 tests passed |
| Full `TZ=Australia/Perth npm test -- --run` | 107 files / 1,258 tests passed |
| Focused `TZ=Australia/Sydney` recovery, calendar, scheduler and backup matrix | 23 files / 415 tests passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Exact-head App CI, App Preview `/app`, Vercel | Pending remote PR checks at the time of this report; verify the final head before disposition |

The first full UTC run had one deterministic outdated copy assertion in `AppShell.smoke.test.tsx` after the Setup limit wording changed: 106 files passed, 1 failed; 1,256 tests passed, 1 failed. The assertion was updated to the new copy and portable export control. The isolated test passed 1 file / 3 tests, and the subsequent full UTC run passed 107 files / 1,257 tests.

Automated UI tests cover file choice, checker status, destructive confirmation and preview invalidation; a phone-width shell smoke test passes. A manual browser walkthrough was unavailable because the browser verification service blocked the local dev URL (`ERR_BLOCKED_BY_CLIENT`). This does not close issue #160's broader mobile acceptance. Portable backup is a user-controlled recovery mechanism; it does not provide automatic sync, an encrypted file format or an infinite-future recurrence precomputation.
