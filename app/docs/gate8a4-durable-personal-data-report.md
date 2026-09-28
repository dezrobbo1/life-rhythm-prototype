# Gate 8A4 — durable personal data v0 implementation report

Base `main`: `697860427cab5008c3c13ef50b4c7201f560932a`, the merge of PR #162. Gate 8A3 is complete. This Gate 8A4 implementation is an open PR pending review and merge. Gate 8A5 and Gate 8B have not started; issue #160 remains open for Gate 8A8 narrow/mobile acceptance.

## Recovery authority

The [canonical class inventory](gate8a4-durable-personal-data-contract.md) records every v6 Dexie store and settings sidecar. A single strict `life-rhythm-portable-profile-backup` format v1 carries combined reviewed settings, explicit preferences, Gate 7E duration controls, rhythm templates/plans/revisions/instances, Today tasks, Task Pool, confirmed placements, trusted Gate 7 factual behaviour events and the static `.ics` source with authored buffers. It excludes auth identity/secrets, development records, legacy operational logs and the derived private scheduler plan. Existing narrow backup/check formats retain their previous authority. The app version is informational; format version governs compatibility.

Export reads the active local namespace in a read transaction and fails on invalid canonical rows or unreadable history. Check is read-only and validates strict classes, IDs, rhythm relationships and current bounded calendar authority before summarizing counts. Malformed/future formats fail closed. Missing singletons in the checked artifact delete corresponding destination state on restore. Unreadable legacy or current destination authority is not erased silently.

Conflict policy is **replace the current local profile**, with no merge or timestamp election. A non-empty destination requires typing `REPLACE LOCAL PROFILE`. The preview expectation compares all affected rows, the derived plan and the destination namespace inside the restore transaction; any change requires checking again. The restore clears affected canonical tables and stale scheduler plan, then writes the validated artifact in one Dexie transaction. A mid-write failure rolls the transaction back. On success the browser reloads, and a fresh private plan builds from restored settings, calendar, preferences and duration controls. Neither export nor restore connects to a provider or uploads personal data.

## Recovery evidence

The representative namespace A fixture includes reviewed settings, one Task Pool item, Today task, placement, configured rhythm, plan, recurrence revision and instance, explicit preference, duration override, trusted behaviour event and calendar source with buffers. Export A → check/restore into empty namespace B → normal repository reads and live scheduler context → export B produces the same canonical payload (excluding regenerated export metadata); A remains unchanged. The restored scheduler has no copied accepted plan and rebuilds successfully. A checked preview from empty B cannot be used in another empty namespace. Other signed-in and legacy namespaces remain unchanged.

Further tests cover confirmed non-empty replacement, cleared stale singletons, changed destination, failed mid-transaction write, unsupported version, unknown class, duplicate IDs, broken rhythm references, archived historical references and duration controls, invalid duration/behaviour sidecars, over-budget calendar, selected JSON files and confirmation UI. Existing Gate 8A3 calendar safety and class-specific backup tests remain in the matrix.

PR review found a second recovery-boundary issue: the reusable Settings schema permits an arbitrary record ID, but normal loading requires `settings`. A tampered v1 artifact with another Settings ID previously passed the checker and could have reported a successful restore of an unreadable profile. A red regression reproduced this; portable checking now requires the canonical Settings ID before any write. The rejected restore leaves prior destination settings unchanged.

Later review found three directly causal validation gaps. The normal `confirmTaskPoolSoftPlacement` path creates a planned placement for a Held item without a Today task, so its real source failed backup; restoration now accepts a live placement backed by either canonical class. Conversely, a crafted artifact could contain two visible placements colliding on date/task or date/block, bypassing the normal placement writer, or an active task whose `custom` source the normal Today repository hides. Red regressions reproduced both problems; checking now rejects the conflicts and unsupported source before replacement. The Held-item test exports and restores a real repository-authored placement into another namespace.

Subsequent review found two more direct integrity gaps and an untrusted-input resource concern. A crafted closed/done rhythm instance paired with a linked active generated Today task had passed identity checking but vanished from scheduling projection; the portable checker now requires lifecycle-state agreement for linked tasks. A raw `dayProfileFoundation` row with unknown fields previously down-converted silently through settings loading; export now strictly validates that raw sidecar and refuses unknown data. Finally, files larger than 16 MiB are rejected before reading, pasted JSON beyond that byte bound is rejected before parsing, and aggregate artifact collections are capped at 10,000 records before schema traversal. Regression tests were red before these corrections and green afterward.

## Validation on final source tree

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed |
| Focused UTC and Perth recovery, calendar, scheduler and backup matrix | 24 files / 426 tests passed in each timezone |
| Full `TZ=UTC npm test -- --run` | 107 files / 1,263 tests passed |
| Full `TZ=Australia/Perth npm test -- --run` | 107 files / 1,263 tests passed |
| Focused `TZ=Australia/Sydney` recovery, calendar, scheduler and backup matrix | 24 files / 426 tests passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Reviewed code head `f92b719c173330326e9c0f1067e7b285be99a706` App CI | Run #267, success |
| Reviewed code head App Preview `/app` | Run #482, success |
| Reviewed code head Vercel | Deployment `dpl_AuSie1Lmt3ModS8HzLUKfEpbycNA`, READY; Git SHA matches |

The first full UTC run had one deterministic outdated copy assertion in `AppShell.smoke.test.tsx` after the Setup limit wording changed: 106 files passed, 1 failed; 1,256 tests passed, 1 failed. The assertion was updated to the new copy and portable export control. The isolated test passed 1 file / 3 tests, and the subsequent full UTC run passed 107 files / 1,257 tests.

App Preview run #481 on the preceding head passed all 1,258 tests but failed on one late `window is not defined` rejection from `SchedulingPreferencesPanel` attributed to `AppShell.smoke.test.tsx` after jsdom teardown. The isolated CI-mode smoke test passed 1 file / 3 tests, and the complete CI-mode UTC matrix passed 107 files / 1,258 tests locally. This was classified as transient teardown timing rather than a deterministic portable-recovery defect. The remote job was retried; the final corrected head requires its own check evidence.

The first full UTC run after the placement correction timed out the unchanged Gate 6 daily-loop test after five seconds (106 passed files, 1 failed; 1,259 passed tests, 1 failed). The test passed in isolation (1 file / 1 test) and the complete affected UTC matrix passed on rerun (107 files / 1,260 tests). This was classified as runner timing, not a reproducible recovery defect.

Automated UI tests cover file choice, checker status, destructive confirmation and preview invalidation; a phone-width shell smoke test passes. A manual browser walkthrough was unavailable because the browser verification service blocked the local dev URL (`ERR_BLOCKED_BY_CLIENT`) and the deployed preview requires Vercel sign-in. This does not close issue #160's broader mobile acceptance. Portable backup is a user-controlled recovery mechanism; it does not provide automatic sync, an encrypted file format or an infinite-future recurrence precomputation. The final corrected head's checks are recorded in the PR body.

## Consolidated PR #163 restore-integrity correction

Review of `e8c140e866249904dc2e14319d14b10f1b8d4e8b` identified five related recovery-boundary failures. Red tests established that omitted canonical fields were silently defaulted; visible task statuses with `showToday: false`, a Pool `today` row without a Today task, and incompatible linked rhythm completion/planning states passed checking; and Settings Save begun before restore could overwrite the restored profile afterward. These were treated as recovery correctness, not Gate 8A5 mutation redesign.

Portable v1 now requires the complete emitted snapshot shape without applying migration/write defaults on import. It validates the shared task-visibility, Pool/Today ownership, and full linked-rhythm lifecycle/completion/planning relations, including normal Held/soft-placed and Minimum Done continuation states. A strict `profile:recovery-generation:v1` operational sidecar in the existing settings store serializes profile-affecting write transactions with restore and fences operations begun against the previous epoch. Settings Save/Reset/migration check the epoch captured before their pre-write reads. Standalone Library, calendar, Pool, behaviour and scheduler-state writes use the guarded transaction; coordinator transactions share the settings lock; the scheduler's canonical snapshot includes the local epoch and old-plan commits do not retry as ordinary planning conflicts. Only a successful restore increments the destination epoch, atomically with profile replacement. Epoch metadata is validated locally and excluded from export; a source-device epoch never becomes destination authority.

Deterministic tests cover both restore/write orderings, two database handles for the same namespace, queued Settings Save/Reset, Pool lifecycle, rhythm, preference and calendar actions, stale scheduler commit, atomic rollback and exact destination-generation increments. Export/check remain read-only, replace-only restore and namespace isolation remain intact. The validation and exact-head deployment evidence for this correction are appended below after final verification; the earlier table above remains historical evidence for the previous reviewed head.

Final corrected-tree validation (the earlier 1,263-test evidence belongs to the preceding reviewed head):

| Check | Corrected-tree result |
| --- | --- |
| Clean `npm ci --ignore-scripts` | Passed |
| Focused UTC, Perth, Sydney recovery/write-path/calendar and Setup smoke matrix | 34 files / 486 tests passed in each timezone |
| Full UTC, Perth, Sydney suite | 107 files / 1,279 tests passed in each timezone |
| Production build | Passed |
| `git diff --check` | Passed |

The manual recovery-screen walkthrough remains unavailable: the local URL was blocked by the browser service, and the deployed preview requires sign-in. This limitation is not misclassified as a code-integrity test pass and does not close the broader Gate 8A8 narrow/mobile issue #160. Exact-head CI, Preview and Vercel evidence is tracked on PR #163 after publishing this correction; no predecessor-head checks are reused.

Transient test evidence on this correction: the first final UTC full run passed 107 files / 1,279 assertions but Vitest also recorded one `window is not defined` unhandled rejection from an asynchronous `SchedulingPreferencesPanel` update after `AppShell.smoke.test.tsx` teardown. The isolated smoke test then passed 1 file / 3 tests, the entire affected UTC matrix including that smoke test passed 33 files / 476 tests, and the complete UTC suite rerun passed cleanly at 107 files / 1,279 tests. This is classified as the previously observed environment/teardown timing symptom, not a reproducible restore-integrity failure; the original noise is retained here rather than hidden.

A subsequent Perth full run passed 106 files / 1,278 tests but one `AppSettingsPersistence.test.tsx` migration test failed: it asserted an asynchronous read-only call before that call occurred. The same isolated test failed in Perth and UTC, establishing deterministic test timing. Its assertion now waits for the expected call; isolated Perth passed 1 test, and the complete affected Perth matrix passed 34 files / 486 tests. The Setup smoke test also waits for its preference catalogue to finish loading before unmount, closing the teardown window without changing product logic. The final full UTC, Perth and Sydney suites then each passed cleanly at 107 files / 1,279 tests; final focused matrices passed 34 files / 486 tests in each timezone.
