# Gate 6 current-surface capability map

This ledger records capabilities reachable in the React/Vite personal trial at the Gate 6A baseline. It is a preservation aid for later navigation work, not a proposed information architecture. `YES` marks MVP or data-safety capability, `SECONDARY` marks capability that must remain reachable without occupying primary navigation, and `MAY RETIRE` marks explicit demo or development scaffolding only.

## Today

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Current saved task | Today | Open Today and view the next useful action | Reads validated `activeTasks`; Gate 6A exposes loading, partial and failed reads | YES | Now | Personal data; must not fall back to example-task facts |
| Start, pause and resume | Today task card | Start task / Pause / Resume | Atomic active-task lifecycle update; scheduler maintenance is best effort | YES | Now task controls | Operational status remains distinct from Minimum achievement |
| Minimum achievement | Today task card | Mark minimum done | Persists `minimumDone` and durable `minimumAchievedAt` | YES | Now task controls | Achievement survives continuation and reload |
| Optional continuation | Today task card | Keep going; open or complete Normal/Full | Updates active-task status while preserving Minimum achievement | YES | Now task controls/details | Higher forms remain optional |
| Stop here / completion | Today task card | Stop here or finish a higher form | Active-task lifecycle write; task leaves Today; private-plan repair follows | YES | Now task controls | Does not create catch-up debt |
| Park / Not today | Today task card | Park / Not today | Active-task and linked Pool/placement lifecycle transaction where linked | YES | Now overflow / Held | Must preserve achievement and task identity |
| Start Boost | Today task card | Open Start Boost, select barrier and support | Presentation-local selection only; no completion write | YES | Now support sheet | Eight barriers; real tasks use neutral or real task copy |
| Add one-off | Today | Open Add one-off, enter versions and save | Validated active-task write to device-local IndexedDB | YES | Capture / Now | Does not add a reusable Library template |
| Details and time edges | Today task card | Expand Details | Reads task purpose, versions and due/fixed/expiry facts | YES | Now details | Empty optional sections are omitted |
| Re-entry review | Today | Review a task after its authored usefulness edge | Pure assessment on persisted time facts and explicit clock | YES | Now / review surface | Derived state; not a persisted failure status |
| Re-entry actions | Today re-entry section | Try Minimum, Park, Not today, No longer needed, Keep for review when valid | Try Minimum is presentation-only; lifecycle actions use existing transactions and repair | YES | Review / Held | No automatic archive, tomorrow move or replacement task |
| Reduce today preview/apply | Today near current task | Reduce today, preview, cancel or apply | Read-only preview; apply recomputes then atomically persists private plan and date-scoped mode | YES | Now day controls | Reduced mode is scoped to one local date |
| Reduced-day Changed / Undo / return | Today reduced-day controls | View Changed, Undo, Return to normal day | Scheduler-plan state plus one-step undo and day-mode context | YES | Changed / day controls | Undo differs from replanning to Normal |
| Today-task backup export | Today | Export Today tasks backup | Reads and serializes validated active tasks; downloads JSON | SECONDARY | Settings / Recovery | Today tasks only |
| Today-task backup check | Today | Paste/select backup, then Check | Parses and previews only; writes nothing; restore is not connected | SECONDARY | Settings / Recovery | Safety function, currently colocated with Today |
| Today data-health state | Today | Wait for load or Retry after warning/failure | Gate 6A result distinguishes empty, partial-invalid and read failure | YES | Surface status | Retry is read-only; invalid rows remain stored |

## Plan

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Automatic private plan | Plan | Open Plan | Reads/builds validated scheduler plan through the canonical coordinator | YES | Plan / Day Line | External calendar time is never treated as writable private work |
| Automatic placement detail | Plan | Read placement cards | Displays target, date/time, execution form and scheduler provenance | YES | Plan details | Generated versus user-confirmed authority remains explicit |
| Refresh/repair | Plan | Refresh private plan | Canonical rolling repair and persisted scheduler-plan write | YES | Plan / Changed | Not invoked by a presentation-read failure |
| Changed | Plan | Read recent automatic changes | Reads persisted repair metadata | YES | Changed | Must match actual before/after state |
| One-step Undo | Plan | Undo last private-plan change | Restores supported private-plan snapshot only | YES | Changed | Does not undo external calendar commitments |
| Day/date selection and Day Shape | Plan | Select weekday/date and inspect protected/available blocks | View-model projection from settings and selected date | YES | Day Line / Plan | Blank calendar time is not implied capacity |
| Soft suggestions | Plan | Review suggested Pool tasks | Reads Pool items plus current date; computes suggestions in memory | SECONDARY | Held / Plan suggestion | Optional Plan dependency; Gate 6A isolates its read failure |
| Add user-confirmed soft placement | Plan | Choose Add to Plan | Writes a validated soft placement and updates linked Pool lifecycle; repair follows | YES | Plan | Does not create a calendar event |
| User-confirmed placements | Plan | View or remove placement | Reads/writes soft-placement table and linked lifecycle | YES | Plan | User-owned authority must remain visible |
| Pool-to-Plan handoff | Pool then Plan | Find soft window / View in Plan | Passes task/date selection in app state; persisted placement remains separate | SECONDARY | Held / Plan | Current manual machinery may become less prominent, not disappear |
| Read-only calendar import | Plan | Select or replace `.ics` file | Validates and stores one local read-only source; repair uses expanded events | YES | Settings / Plan | Recurring rules are rejected; no external writes |
| Remove calendar source | Plan | Remove calendar | Deletes only saved local source then repairs private plan | YES | Settings / Plan | Explicit user action |
| Manual-data health state | Plan | Wait or Retry manual Plan data | Gate 6A isolates Pool/soft-placement loading, partial and read failure | YES | Surface status | Automatic plan stays visible when optional data fails; Retry does not rebuild it |

## Pool

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Capture task | Pool | Capture task and enter Minimum/optional details/useful window | Validated Task Pool item write | YES | Capture / Held | Does not add to Today or calendar by itself |
| Holding and status groups | Pool | View captured, deferred, parked, not-today, suggested and softly placed items | Reads validated `taskPoolItems`; derives resurfacing groups | YES | Held | Personal holding state, not a backlog/debt list |
| Add/bring to Today | Pool | Add to Today / Bring to Today | Linked Pool + active-task lifecycle transaction; repair follows | YES | Held | Avoids duplicate active tasks |
| Defer / bring back later | Pool | Choose Bring back later and a date | Persists validated deferral metadata | YES | Held | Resurfacing time does not create a hard schedule |
| No longer needed | Pool | Choose Other choices → No longer needed | Linked lifecycle transaction removes eligible active/soft placement state | YES | Held | Explicit action; no unrelated deletion |
| Plan handoff | Pool | Find soft window / View in Plan | Navigation hint plus Plan's soft-placement path | SECONDARY | Held / Plan | No calendar event is created |
| Task Pool backup export/check | Setup | Export or Check Task Pool backup | Export reads validated items; check parses without restore/write | SECONDARY | Settings / Recovery | Backup controls are not currently on Pool itself |
| Pool data-health state | Pool | Wait or Retry after warning/failure | Gate 6A distinguishes empty, partial-invalid and read failure | YES | Surface status | Valid rows remain usable; invalid rows remain stored |

## Library

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Browse reusable rhythms | Library | Search and filter catalogue/categories | Built-in snapshot plus saved custom templates | YES | Library / Capture | Built-in entries are catalogue content, not personal completion state |
| Create custom rhythm | Library | Create rhythm | Validated custom rhythm-template write | YES | Capture / Library | Reusable template, not an active occurrence |
| Enable/disable rhythm | Library | Enable rhythm / Disable rhythm | Current built-in enablement is session presentation; custom create copy also labels enablement preview-only | SECONDARY | Library settings | Persistence is not yet a complete user-owned enablement system |
| Add rhythm to Today now | Library | Add to Today now | Creates one linked active task; does not rewrite Library | YES | Library → Now | Deduplicates existing active instance |
| Quick-pack preview/enable | Library | Preview pack / Enable selected rhythms | Session-only enablement over fixture catalogue | MAY RETIRE | Library recommendations | Demo/sample convenience, not durable personal configuration |
| Library rhythm backup export | Library | Export Library rhythms backup | Exports saved custom rhythms only | SECONDARY | Settings / Recovery | Excludes Today, settings, enablement and packs |
| Library rhythm backup check | Library | Paste/select and Check | Read-only parse/preview; restore not connected | SECONDARY | Settings / Recovery | Writes nothing |
| Saved Library read health | Library | Automatic load of custom rhythms | Existing loader still collapses read/invalid failure to absence | YES | Follow-up foundation slice | Deliberately excluded from Gate 6A because it needs its own surface migration |
| Create pack later | Library | Disabled button | No implementation | MAY RETIRE | Library | Explicit scaffold only |

## Settings / Setup

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Theme | Setup and Setup shell control | Choose appearance theme | Validated settings write when settings are saved; shell preview updates locally | YES | Settings | Current theme tokens remain authoritative |
| Life Shape anchors | Setup | Enter work, commute, commitments, buffers, meals, wake and sleep | Validated settings write | YES | Settings | Feeds day-shape and scheduling input |
| Low-capacity-day preference | Setup | Choose preference | Validated settings write | YES | Settings | Does not itself invoke Reduce today |
| Time to leave alone | Setup | Add/edit/remove time blocks and scheduler-use boundary | Validated settings write | YES | Settings | Protects unavailable/ask-first time |
| Start Boost safety | Setup | Configure safety choice | Validated settings write | YES | Settings | Support boundary, not scheduler scoring |
| Save/reset settings | Setup | Save settings / Reset settings to defaults | Validated settings persistence | YES | Settings | Reset here is settings-only |
| Settings backup export/check | Setup | Export or Check settings backup | Export reads validated settings; checker is read-only; restore not connected | SECONDARY | Settings / Recovery | Separate from task/rhythm data |
| Soft-placement backup export/check | Setup | Export or Check soft placement backup | Export reads placements; checker is read-only; restore not connected | SECONDARY | Settings / Recovery | No calendar events included |
| Task Pool backup export/check | Setup | Export or Check Task Pool backup | Export reads Pool items; checker is read-only; restore not connected | SECONDARY | Settings / Recovery | Preserves status and deferral metadata |
| Trial limits / About | Setup | Read current limitations and application information | Static presentation | SECONDARY | Help / About | Should remain findable, not primary |
| Dev tickets / future modules / later backup actions | Setup | Click placeholder actions or inspect module list | Presentation-only status; no feature write | MAY RETIRE | Development-only | Explicit scaffolding, not user capability |

## Reset

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Reduce excess Today tasks | Reset | Run Too much today / move-extra style actions | Updates extra active tasks to notToday or parked; does not delete | YES | Reset / Held | Keeps one next action and preserves identity |
| Restart with one action | Reset | Choose restart-one-action | Reads current task and shows its Minimum; no completion write | YES | Reset / Now | Presentation aid only |
| Restore-hidden and secondary reset previews | Reset | Choose secondary action | Current implementation is confirmation/preview only | SECONDARY | Reset / Recovery | Must remain truthfully labelled until connected |
| Full reset guard | Reset | Type RESET and confirm disabled action | No data deletion; reports that full reset is disabled | MAY RETIRE | Settings / Recovery | Safety scaffold, not a functioning destructive reset |

## Example day

| Capability | Current screen | Current user action | Persistence/read-write boundary | Must survive Gate 6? | Likely future destination | Notes/dependencies |
|---|---|---|---|---|---|---|
| Read-only example | Secondary navigation → Example day | Open example, inspect Today/Pool/Plan/Library sample, return to personal trial | Fixture-only; no local reads or writes | SECONDARY | Onboarding / Help | Explicitly separate from personal state; may move out of primary shell |

## Gate 6A read-boundary classification

| Dependency | Classification | Gate 6A treatment |
|---|---|---|
| Today active tasks | Hard display dependency | Quiet loading; truthful empty; valid rows with partial warning; read-failed state with read-only Retry |
| Pool task items | Hard display dependency | Same five states; capture waits until the initial read is known |
| Pool soft-placement dates | Optional dependency | Pool items remain visible; placement handoff warning is isolated |
| Plan private scheduler state | Hard for the automatic-plan section | Existing typed coordinator result retained; no new scheduler read/write behavior |
| Plan Pool items and soft placements | Optional/manual-section dependencies | Failure suppresses only false empty claims for manual sections; automatic plan stays visible; Retry rereads without rebuilding |
| Plan read-only calendar | Independent scheduling dependency | Existing typed invalid/read-failure handling retained |
| Library custom rhythms | Separate follow-up | Same risk exists, but its loader/surface were not migrated in this bounded PR |
