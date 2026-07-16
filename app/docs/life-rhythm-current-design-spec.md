# Life Rhythm Current Design Spec

Status: Living design specification
Scope: Product direction, current implementation state, design boundaries, source authority, and near-term roadmap
Last consolidated after: PR #105 merge - Task Pool backup and post-merge documentation reconciliation

Current branch note: this document describes `main` at code baseline `553b83f`. PR #103, PR #104 and PR #105 are merged into `main`; the bounded Task Pool export/check path, timezone-safe UTC/Perth verification and documentation synchronization are part of the current baseline. The next work is fresh visual/product validation.

The repository-level authority map is `docs/DOCUMENTATION_AUTHORITY.md`. It defines the distinction between the protected root 1.4.6 legacy runtime, the current `/app` architecture, source evidence, and historical contracts.

## 1. Product Identity

Life Rhythm is a non-clinical self-management app for adults with ADHD traits or an ADHD diagnosis.

It supports rhythms, task initiation, task capture, safe holding, re-entry after missed or disrupted days, protected time, and soft planning. The app is designed for people who often benefit from rhythm and structure but may resist rigid scheduling, external pressure, shame-based productivity systems, or tools that turn daily life into a timetable.

Life Rhythm is not a medical product. It must not diagnose, treat, monitor clinical compliance, claim medical outcomes, replace therapy, replace coaching, replace occupational therapy, provide crisis support, provide medication advice, provide financial advice, or present itself as clinical care.

Life Rhythm must avoid:

- diagnosis or treatment language
- medical outcome claims
- therapy or coach-authority framing
- compliance monitoring
- shame or failure language
- scores
- streak pressure
- public accountability
- coercive reminders
- productivity punishment
- dopamine-hack language
- gamified pressure
- “you are behind” framing
- productivity dashboards
- missed-task dashboards
- automatic scheduling claims
- calendar ownership of the day

The product should remain calm, practical, private, local-first, and user-led.

## 2. Core Product Principle

The central product principle is:

> Power underneath. Calm on the surface.

Life Rhythm can have strong modelling, validation, persistence, backup, and planning logic underneath, but the user-facing experience should stay light, forgiving, and non-coercive.

Supporting principles:

- Rhythm without capture.
- Structure without ownership of the whole day.
- Re-entry without punishment.
- Planning without life becoming a timetable.
- Not every unscheduled gap is available.
- Minimum done counts.
- Parked is safe, not failed.
- Not today is allowed.
- Blank time is not automatically task space.
- Captured does not mean due today.
- Held does not mean forgotten.
- A soft placement is not a calendar event.

The intended product spine is:

> capture → hold safely → find soft window → user confirms → re-enter later if missed or deferred → respect usefulness windows.

The product should help users protect their life from overfilling, not simply find more gaps to consume.

## 3. Source Authority and Research Governance

The current repo design spec is the implementation authority for the `/app` product direction and current status. The root `index.html` remains a protected legacy runtime and is not the authority for new `/app` behaviour.

The project-source additions from 2026-06-26 and the consolidated `Life_Rhythm_All_Project_Sources_2026-07-12.zip` are source-governance and provenance material. They define how research packets, Packet V3 upgrades, NotebookLM drafts, benchmark sources, and Codex UI/UX guardrails should be interpreted.

Current source hierarchy:

1. Canonical product direction: this design spec and current repo contracts.
2. Canonical V3 packet direction: Packet 1 V3 is current for re-entry and missed-task recovery.
3. Source-library evidence: existing packets, especially 1, 4, 11, 12, 19, 20, and 25.
4. Provisional audit / triage: the full-library validation audit is a useful priority map, not complete line-by-line verification of every packet and citation.
5. Non-canonical ideation: NotebookLM v1.2 documents, commercial benchmark articles, coaching heuristics, Reddit/community sources, and internal speculative syntheses.
6. Quarantined speculative material: medication-window mapping, biometric capacity prediction, crisis detection, automatic rescheduling, AI coach authority, sync/telemetry assumptions, and neurochemical activation claims.

NotebookLM v1.2 documents are not implementation specifications. They may be mined for ideas only after source classification and safety review.

Commercial app benchmark pages, Reddit/community sources, INCUP/coaching material, product blogs, and internal neuro-computational syntheses are not evidence anchors. They can suggest research questions, competitor patterns, and copy warnings. They cannot validate adult-ADHD product claims.

The current re-entry/V3 direction is represented by the standalone `Re-entry and Missed-Task Recovery in Adult ADHD for Life Rhythm` research document and the Packet 1 V3 governance material in the consolidated source bundle. The embedded packet collection also contains the evidence-strengthened Packet 1 V2 PDF; these are related but distinct source layers. The current re-entry evidence standard is:

- strong support for non-clinical and product-boundary caution
- moderate indirect support for low-friction re-entry mechanics
- sparse direct adult-ADHD interface evidence
- exact wording, timing, thresholds, menus, and algorithms remain prototype hypotheses

Corrected packet grouping:

| Role | Packets |
| --- | --- |
| MVP core | 1, 4, 11, 12, 19, 25 |
| MVP supporting | 9, 20 |
| Guardrail-only | 10, 24 |
| Merge before product use | 2 + 21 + 24, 3 + 15, 6 + 14 |
| Source-only / later | 6, 7, 13, 14, 16, 17, 18, 22, 23 |

Corrected V3 packet order:

1. Packet 4 — Right-Sized Tasks
2. Packet 12 — Task Initiation / Avoidance / Time Estimation
3. Packet 25 — Calendar Load / Soft Scheduling Boundaries
4. Packet 20 — Emotional Regulation / Shame / Failure Recovery
5. Packet 9 — Retention / Re-entry / Notifications
6. Packet 19 — Work Focus / Context Switching / Re-entry
7. Merge Packets 2 + 21 + 24
8. Merge Packets 3 + 15
9. Merge Packets 6 + 14
10. Refresh Packet 10

## 4. Current Implementation State After PR #105 Merge

The app has a real local-first foundation. It is no longer a static prototype shell.

Implemented:

- settings persistence
- theme persistence
- Start Boost safety persistence
- Life Shape persistence
- settings backup export
- settings backup validation preview
- custom Library rhythm persistence
- Library rhythm backup export
- Library rhythm backup validation preview
- active Today task persistence
- Add one-off Today tasks
- Add Library rhythm to Today
- active task status persistence
- Start / Pause / Resume / Minimum done
- Minimum, normal, and full completion endpoints through existing task statuses
- Stop here / Park / Not today
- active task backup export
- active task backup validation preview
- active task deadline/time-edge schema fields
- optional Time edge section in Add one-off
- one-off flexible/dueBy/fixedAt/expiresAfter capture
- calm Today card time-edge copy
- Re-entry review section in Today
- read-only time-edge re-entry preview
- user-confirmed Park safely and Mark not today from re-entry review
- Try the minimum helper copy only
- Task Pool schema and repository
- task pool Dexie table for local-first captured/deferred items
- top-level Pool screen
- four-tab primary shell: Today / Plan / Pool / Library
- Reset removed from primary bottom navigation and available as a secondary shell action
- Setup/Settings removed from primary bottom navigation and available as a secondary shell action
- Task Pool UI moved out of Plan into Pool/shared Pool panel
- visible Inbox wording removed from app UI
- Task Pool capture UI in the Pool/shared Pool panel
- Pool/shared Pool panel list for safely held captured/deferred items
- No longer needed action for task pool items
- Pool-based soft window suggestions from eligible held items
- user-confirmed soft placement from the Pool into explicit `openCapacity`
- linked Pool/Today/placement state updates and safe placement re-use after removal
- deferred-task resurfacing without automatically moving tasks into Today
- Life Shape protected/recovery/loose/household/family/open-capacity blocks
- Setup “Time to leave alone” controls
- fixed commitments notes-only clarity for trial
- read-only Day Shape preview in Plan
- read-only Plan soft suggestions
- openCapacity-only Add soft placement
- saved soft placements in Plan
- Remove placement marks a placement removed without deleting the task
- soft placement schema and repository
- soft placement backup export
- soft placement backup validation preview
- removed placements included in soft placement backups as explicit local state
- Task Pool backup export with saved Pool status and deferral metadata
- Task Pool backup validation preview
- trial account/auth boundary contract
- opt-in Clerk auth shell
- signed-out trial access shell
- signed-in account bar
- user-scoped hashed local database namespaces
- legacy local data handoff notice
- Trial limits note in Setup
- final personal-trial smoke QA completed
- mobile trial polish pass completed
- backup confidence copy pass completed
- Reset relief-valve actions functional for trial
- Narrow Today marks extra visible Today tasks notToday
- Park extras safely marks extra visible Today tasks parked
- Restart with one action surfaces the first visible Today task
- Restore hidden items remains preview-only
- Full app reset remains disabled and non-destructive
- visual design system contracts
- Soft Ledger / Holding Tray visual direction contract
- navigation redesign contract
- object grammar spec
- theme system contract
- semantic visual theme tokens
- low-level surface class primitives
- research source governance docs

Partially implemented:

- Pool ledger-row / Holding Tray visual implementation: Pool now exists as a first-class destination and uses the shared Pool panel, but the full Soft Ledger / Holding Tray visual treatment still needs refinement.

Not implemented yet:

- broad card-soup / pill-chip reduction across Plan and other screens
- repeating rhythm instances
- broader resurfacing for parked, not-today, and rhythm-instance tasks
- missed-task detection
- missed status persistence
- askFirst placement
- move/edit soft placement
- automatic scheduling
- scheduler-owned placement
- calendar load
- iOS/native calendar integration
- cloud sync
- AI pattern suggestions
- import/restore execution
- notifications
- full visual/object-grammar parity
- external tester readiness

Current practical status:

- A basic shell/usability trial is possible with one browser, one device, and one stable URL.
- A basic personal manual trial can exercise local settings, Library rhythms, active Today tasks, one-off time edges, protected time, Day Shape preview, Re-entry review, Task Pool capture, deferred holding, Pool-based soft suggestions, user-confirmed open-capacity soft placements, Task Pool and soft placement backups, Reset relief-valve actions, and opt-in signed-in local profiles.
- Task pool capture exists in the Pool/shared Pool panel, and captured ad hoc tasks can be safely held outside Today.
- Pool can show captured, parked, not-today, deferred and ready-to-revisit items. Held tasks are not automatically scheduled or added to Today.
- The current UI still has known generic AI-coded / SaaS / card-soup risks. Visual contracts exist, but they are not fully implemented.
- A meaningful test of the full intended soft scheduling product should wait until repeating rhythm instances, broader calm resurfacing, the Pool Holding Tray visual refinement, and backup confidence for all intended data classes are stronger.
- External tester readiness should wait until onboarding, backup confidence, Clerk invite-only/public-signup configuration, and visual/object-grammar alignment are stronger; first-class Pool navigation is no longer the missing blocker.

## 5. PR Milestone Snapshot

Recent key milestones:

- PR #29: settings persistence with validation
- PR #30: settings backup export
- PR #31: settings backup import validation preview
- PR #32: settings backup/recovery UX polish
- PR #33: Library rhythm persistence contract
- PR #34: Library rhythm backup validation scaffolding
- PR #35: user-created Library rhythm persistence
- PR #36: create rhythm save failure handling
- PR #37: Library rhythm export backup action
- PR #38: Library rhythm import validation preview
- PR #39: Today active task persistence contract
- PR #40: Add to Today and one-off active task persistence
- PR #41: Today completion and re-entry states
- PR #42: active task backup validation scaffolding
- PR #43: active task export backup action
- PR #44: active task backup import validation preview
- PR #45: soft scheduling and protected time contract
- PR #46: deadline and re-entry contract
- PR #47: active task deadline schema support
- PR #48: Life Shape protected time schema and Setup UI
- PR #49: read-only Day Shape preview
- PR #50: one-off task time edge controls
- PR #51: current design spec added
- PR #52: trial account/auth boundary contract
- PR #53: invite-only Clerk auth shell
- PR #54: auth-aware local data namespaces
- PR #55: auth local data handoff notice
- PR #56: design spec updated through auth handoff
- PR #57: read-only time-edge re-entry preview
- PR #58: user-confirmed re-entry actions
- PR #59: read-only soft schedule suggestions
- PR #60: user-confirmed soft placement contract
- PR #61: soft placement schema and repository
- PR #62: user-confirmed soft placement from open-capacity suggestions
- PR #63: saved soft placements shown in Plan with safe removal
- PR #64: soft placement backup export and read-only validation preview
- PR #65: design spec updated through soft placement backup
- PR #66: trial hardening smoke QA pass
- PR #67: personal trial checklist
- PR #68: personal trial launch note
- PR #69: fixed commitments trial clarity
- PR #70/#71: task completion endpoint clarity
- PR #75: final personal trial smoke QA
- PR #76: personal trial readiness report
- PR #77: design-board visual alignment pass
- PR #78: icon and brand system alignment
- PR #79: design-board component rhythm polish
- PR #80: Reset relief-valve actions trial-functional
- PR #81: personal-trial visual polish
- PR #82: post-PR81 trial readiness reconciliation
- PR #83: soft scheduling loop contract and design-spec update
- PR #84: documentation label cleanup
- PR #85: Task Pool schema and repository
- PR #86: Task Pool capture and Plan inbox/list
- PR #87: visual design system contracts
- PR #88: visual token foundation
- PR #89: research source governance and design-spec consolidation
- PR #90: first-class Pool screen and four-tab Today / Plan / Pool / Library shell
- PR #103: Personal Trial v1 loop consolidation and Pool-to-Plan soft-placement flow
- PR #104 merged: preserve deferred state, safely re-use removed placements, and retain saved placement dates when opening Plan
- PR #105 merged: add Task Pool backup export/read-only validation, timezone-safe fixture reconciliation, and documentation authority consolidation

The app foundation is deliberately staged: schema and persistence first, then read-only previews, then controlled user-facing behaviour, then bounded soft suggestions and user-confirmed placement. The next stage should reduce visual/product-object drift, close backup disclosure gaps, and validate the current loop before adding repeating rhythm instances or broader resurfacing.

## 6. Data and Write Boundaries

Current approved write surfaces:

1. Settings only
2. Custom Library rhythms only
3. Active Today tasks only
4. Active task status updates only
5. Task Pool / held-item writes only
6. User-confirmed soft placements only
7. Auth identity shell / local namespace selection only

Current settings writes include:

- theme
- Start Boost safety settings
- Life Shape
- Life Shape time blocks

Current Library writes include:

- user-created custom rhythm templates only

Current Today writes include:

- Add one-off Today tasks
- Add Library rhythm to Today
- status updates for active tasks

Current Task Pool writes include:

- captured ad hoc task pool items
- no-longer-needed status updates
- no automatic add-to-Today
- no automatic scheduling
- no automatic resurfacing
- deferral and bring-back-later state
- Pool-to-Today movement after explicit user action

Current soft placement writes include:

- openCapacity-only user-confirmed soft placements
- removal by marking placement status removed
- safe re-use of a removed placement identity after explicit re-confirmation
- no task deletion
- no active task status change
- no calendar write

Current auth/local-profile surfaces:

- opt-in Clerk identity shell
- signed-out trial access screen
- signed-in account bar
- hashed user-scoped local database namespaces when auth is enabled
- legacy local setup handoff notice when existing local data is detected

Current read-only or non-write surfaces:

- settings backup validation preview
- Library rhythm backup validation preview
- active task backup validation preview
- soft placement backup validation preview
- Task Pool backup validation preview for saved Pool rows and deferral metadata
- Day Shape preview
- Re-entry review preview
- read-only soft suggestions
- scheduler contracts
- deadline/re-entry contracts
- protected-time contract
- visual design contracts
- research governance docs

Explicitly not implemented:

- no scheduler writes
- no calendar writes
- no AI writes
- no backend
- no sync
- no cloud data upload
- no analytics
- no public signup in the app UI
- no import/restore execution yet
- no task history or completion logs yet
- no notification system
- no calendar integration
- no migration execution exposed to users

Import/check flows are validation previews only. They must not silently restore or mutate user data.

## 7. Life Shape and Protected Time Model

Life Shape describes the user’s real day shape. It should not be treated as a productivity timetable.

Life Shape currently includes:

- usual work hours
- meal anchors
- sleep/wake anchors
- fixed commitments notes-only for trial
- commute/travel
- transition buffers
- low-capacity preference
- protected time blocks
- recovery time blocks
- loose time blocks
- household flow blocks
- family time blocks
- open capacity blocks

Time block meanings:

- `protectedTime`: time the user wants left alone by default. Default scheduler use: unavailable.
- `recoveryTime`: low-demand rest, decompression, or reset time. Default scheduler use: unavailable.
- `looseTime`: unstructured time that can stay unstructured. Default scheduler use: askFirst.
- `householdFlow`: home-life movement and responsibilities that may not be precisely scheduled. Default scheduler use: askFirst.
- `familyTime`: family, partner, parenting, care, or social time. Default scheduler use: unavailable.
- `openCapacity`: time the user has explicitly marked as possible planning space. Default scheduler use: available.

Core rule:

> Blank time is not automatically available.

Open capacity is the only block type that should be treated as potentially available by default, and even then scheduler output must remain suggestive, explainable, and user-confirmed.

## 8. Today Model

Today is the main action surface. It should show one useful next action and avoid overwhelming the user.

Today supports:

- one useful next action
- one-off today-only tasks
- Add to Today from Library
- optional Time edge section in Add one-off
- one-off flexible/dueBy/fixedAt/expiresAfter capture
- calm time-edge display copy on Today cards
- Re-entry review for tasks whose useful windows may need calm review
- user-confirmed Park safely from Re-entry review
- user-confirmed Mark not today from Re-entry review
- Try the minimum helper copy only
- minimum / normal / full versions
- Start
- Pause
- Resume
- Minimum done
- Stop here
- Park
- Not today

Active task statuses include:

- active
- inProgress
- paused
- minimumDone
- done
- parked
- skipped
- notToday

Future task statuses may include:

- missed
- archived

Today rules:

- Minimum done counts.
- A task can be parked without shame.
- Not today is allowed.
- The app should not create a catch-up pile.
- One visible action is usually better than many simultaneous demands.
- When one task leaves Today, another task can appear only if it already exists and is safe to show.
- Task state should be practical, not moral.
- Time-edge data describes usefulness; it must not schedule anything by itself.
- Re-entry review does not mark tasks missed by itself.
- Re-entry actions are user-confirmed only.

## 9. Task Pool / Holding Tray Model

Task Pool is the safe holding layer for captured, parked, not-today, deferred, and future missed/re-entry objects.

Current implemented behaviour:

- Task Pool schema and repository exist.
- Task Pool Dexie table exists.
- Pool is a first-class top-level destination in the primary Today / Plan / Pool / Library shell.
- Captured ad hoc tasks can be saved locally.
- Pool/shared Pool panel shows a basic task pool list.
- Task Pool UI has moved out of Plan into Pool/shared Pool panel.
- Visible Inbox wording has been removed from the app UI.
- Captured tasks do not enter Today.
- Captured tasks do not create soft placements.
- No scheduler writes occur from capture.
- No calendar writes occur from capture.
- No longer needed marks an item quiet without deleting it.

Future intended behaviour:

- Held items should feel safely held, not backlogged, queued, late, or owed.
- Pool should continue moving toward ledger rows and holding-tray grouping, not card soup.
- Pool should not show red counts, overdue counts, guilt totals, inbox-zero pressure, or backlog language.
- No-longer-needed items should be quiet/collapsed, not a failure list.

Pool must not become:

- backlog
- inbox-zero system
- task debt list
- overdue queue
- guilt ledger
- productivity dashboard
- catch-up list

## 10. Deadline and Time-Edge Model

Deadline and time-edge schema support exists for active tasks, and Add one-off exposes optional time-edge controls. Today has a read-only time-edge re-entry preview with user-confirmed Park safely and Mark not today actions.

Full missed-task detection and missed status persistence are not implemented yet.

Supported fields:

- timeConstraint
- dueAt
- fixedAt
- expiresAfter
- latestUsefulStartAt
- notUsefulAfter
- minimumStillUsefulAfterDeadline
- missedPolicy

Current Add one-off UI supports:

- Flexible
- Due by
- Fixed at
- Expires after
- optional latest useful start
- optional not useful after
- minimum still useful after deadline
- missed policy selection for future re-entry behaviour

Deadline principles:

- Deadlines are usefulness windows, not pressure.
- A time edge describes when an action is useful.
- A task can become less useful without becoming a failure.
- Time-edge data must not schedule anything by itself.
- The minimum version should remain valid when it still helps.
- After a useful window passes, the user should get calm choices.

Avoid wording such as:

- overdue
- late
- failed
- urgent
- behind

Use wording such as:

- Useful before
- Tied to
- Useful until
- Minimum still helps
- No schedule created
- Move, park, or mark not today
- No longer needed is allowed

## 11. Re-Entry Model

Re-entry is core to Life Rhythm.

The app should assume that disruption is normal. Missed, skipped, parked, or not-today tasks should be safely held, not treated as evidence of failure.

Current implemented re-entry behaviour:

- Today can show a Re-entry review section for active tasks whose time-edge data suggests their useful window may need review.
- Re-entry review copy says nothing has moved and there is no catch-up pile.
- Park safely and Mark not today are user-confirmed actions.
- Try the minimum is helper copy only; it does not create a new state.
- These actions use existing active task status updates.
- No automatic missed-task persistence exists yet.

Future re-entry may offer choices such as:

- do the minimum version
- move later
- park safely
- mark not today
- mark no longer needed
- choose another task
- review later

Re-entry rules:

- Missed tasks must not auto-stack into Today.
- Skipped tasks must not be shown as failure.
- Parked tasks should remain safe and findable.
- Minimum done counts.
- Nothing moves unless the user chooses.
- No re-entry flow should imply penalty, judgement, or duty-to-perform.
- Re-entry should happen at sensible moments, not every time the app opens.
- The product should not ask the user to catch up. It should help them re-enter.

## 12. Soft Scheduling Loop Direction

The full soft scheduling loop remains a staged product direction. Its current contract is `app/docs/soft-scheduling-loop-contract.md`, which documents both the implemented PR #103/#104 subset and the remaining future boundaries.

The intended loop is:

> capture → hold safely → find soft window → user confirms → re-enter later if missed or deferred → respect usefulness windows.

Life Rhythm is not a rigid scheduler. It should capture ad hoc tasks and repeating rhythm instances into a safe task pool, hold parked/not-today/deferred items without turning them into a guilt list, use explicit open capacity for soft suggestions, and bring items back calmly when there is a plausible window.

Scheduler-owned placement is not implemented. The current implementation is a bounded, user-confirmed Pool suggestion flow rather than an automatic scheduler.

Current implemented soft-placement-adjacent behaviour:

- Plan can show read-only soft suggestions.
- Pool items can receive a bounded soft-window suggestion from explicit open capacity.
- The user can confirm a Pool-to-Plan soft placement.
- Soft suggestions are not placements.
- Blank time is not treated as available.
- Suggestions only use openCapacity blocks as addable placement targets.
- askFirst blocks may appear as possibilities, but are not accepted yet.
- protectedTime, recoveryTime, and familyTime remain unavailable by default.
- Users can add a soft placement only from an openCapacity suggestion.
- Soft placement is local only.
- Soft placement is not a calendar event.
- Saved soft placements appear in Plan for the selected day.
- Remove placement marks the placement removed without deleting the task.
- Removed placements are included in backup as explicit local state.
- Soft placement backup export exists.
- Soft placement backup checking is read-only.
- No soft placement restore exists yet.
- Task Pool backup export includes saved Pool rows, status, useful-window fields, and `bringBackAfter` deferral metadata.
- Task Pool backup checking is read-only.
- Task Pool backup does not include settings, Today tasks, Library rhythms, soft placements, calendar data, scheduler output, or restore/import execution.

Future soft-window expansion must be explainable, user-led, and respectful of protected/loose/open capacity. Current v1 is deliberately limited to eligible Pool items, explicit `openCapacity`, one user-confirmed placement path, and no automatic Today insertion.

The current and future soft-window logic must not:

- silently fill the day
- treat blank time as available
- schedule into protected time by default
- schedule into loose time without asking
- create catch-up piles
- punish skipped or missed tasks
- create pressure language
- score the user
- write calendar events
- auto-create active tasks from enabled rhythms
- expose internal debug metadata in the daily UI

Candidate-window output must remain separate from persisted task state until the user explicitly accepts or edits it.

Correct model:

> Life Rhythm suggests. The user decides.

Not:

> Life Rhythm owns the day.

## 13. Visual and Interaction Direction

The current visual direction is:

- primary direction: Soft Ledger
- supporting metaphor: Holding Tray
- fallback: Rhythm Notebook
- desired feeling: “I can trust this to hold things for me without it turning my life into a dashboard.”

The interface must not feel like:

- generic AI chat app
- shadcn/Tailwind demo
- SaaS dashboard
- productivity command centre
- habit-streak app
- task-manager clone
- calendar replacement
- clinical app
- gamified ADHD tool
- life optimizer

Known current UI risk:

The app still contains card soup, pill-chip overload, boxed panels, generic icon badges, and equal-weight surfaces. The primary shell has moved to Today / Plan / Pool / Library, but the runtime UI is still only partially aligned with the Soft Ledger / Holding Tray object grammar.

Current visual contracts:

- `app/docs/visual-design-direction-contract.md`
- `app/docs/navigation-redesign-contract.md`
- `app/docs/object-grammar-spec.md`
- `app/docs/theme-system-contract.md`

Current token foundation:

- semantic visual theme tokens exist
- low-level surface class primitives exist
- Paper / Tide / Clay / Night token foundations exist
- legacy theme aliases remain compatible

Near-term visual implementation priority:

1. Refine Pool toward the Holding Tray / ledger-row visual direction.
2. Reduce card wrapping and decorative pill-chip metadata across Plan and other non-dominant screens.
3. Refine Today around one dominant active object with quiet exits.
4. Validate the current Pool soft-window flow and improve broader re-entry/resurfacing after the visual/product-object drift is reduced.
5. Preserve plain labels, no badges, no counters, no urgency states.

Visual PRs must not introduce:

- AI surfaces
- analytics
- notifications
- calendar integration
- task history dashboards
- completion logs
- gamified themes
- theme marketplaces
- custom font experiments
- broad animation work

## 14. AI Direction

AI is future work.

AI should be background support, not the app’s core system. The app must remain useful without AI.

Future AI may suggest:

- hidden edges
- rhythm packs
- pattern observations
- schedule preferences
- re-entry options
- smaller minimum versions
- possible protected-time rules
- wording for user review

AI must not:

- diagnose
- treat
- score
- enforce
- shame
- act as therapist
- act as coach authority
- schedule tasks directly
- decide what the user must do
- write task state
- write calendar events
- silently alter settings
- execute imports or restores
- explain why the user missed something
- infer ADHD severity, mood, reliability, productivity, or symptoms from app behaviour

AI suggestions must remain pending until the user accepts, edits, or dismisses them.

Best future model:

> Life Rhythm is the system. AI is a proposal layer.

Not:

> AI is the system. Life Rhythm is just the interface.

AI should not be introduced until the core daily loop, scheduler boundaries, data-minimisation boundaries, and user-confirmed write patterns are stable.

## 15. Trial Account and Login Direction

Auth/login shell support exists for trial access, behind opt-in environment configuration.

Important distinction:

> Login is not the same as cloud sync.

A login system identifies a user. It does not automatically mean Life Rhythm data should be uploaded.

Current account direction:

- Clerk is the first auth-shell provider.
- Auth activates only when enabled and configured.
- Signed-out users see a calm trial access shell.
- Signed-in users see a minimal account bar.
- Signed-in users use hashed user-scoped local database namespaces.
- Legacy local setup handoff notice appears when existing legacy local data is detected.
- Invite-only trial access remains the intended operational model.
- No public signup by default.
- Identity/access layer first, not cloud sync.
- Local-first data remains local unless a later sync contract explicitly approves upload.
- No admin reading personal task data by default.
- No analytics by default.
- Backup/export remains user-controlled.
- Sign-out does not delete local data.
- Sign-in does not silently merge existing local data.
- Pre-auth/local legacy data remains untouched.
- Account deletion/export requirements should be defined before broader external trials.
- Cloud sync requires a separate contract and privacy/security review.

Core rule:

> Login may identify the user. Login must not silently upload Life Rhythm data.

Remaining auth-adjacent work:

1. Operational Clerk invite-only/public-signup verification.
2. Account-aware backup/export wording.
3. Cloud sync only after a separate sync contract, if needed at all.

Auth should not be added casually. It changes privacy expectations.

## 16. Trial Readiness

There are three trial levels.

### Basic shell/usability trial

Ready for a limited shell/usability trial with one browser, one device, and one stable URL.

The app can already support local settings, Library, Today tasks, task states, data-class-specific backups, protected time blocks, Day Shape preview, Add one-off time edges, Re-entry review, read-only soft suggestions, user-confirmed open-capacity soft placements, saved soft placements, Task Pool and soft placement backups, Reset relief-valve actions, Trial limits copy, fixed-commitments notes-only clarity, task pool capture in Pool, and opt-in local signed-in profiles.

However, it does not yet have missed-task detection, askFirst placement, move/edit placement, calendar integration, AI suggestions, import/restore execution, or external tester readiness.

It is not yet sufficient to test the full intended soft scheduling loop because repeating rhythm instances, broader calm resurfacing, backup support for future rhythm instances, and the remaining placement boundaries are not implemented.

### Meaningful personal product trial

Meaningful full-product trial should wait for:

- Pool Holding Tray / ledger-row visual refinement
- Plan card/pill reduction
- Today dominant-object refinement
- a fresh post-merge walkthrough of Pool → Plan on `main`
- timezone-safe date-sensitive tests passing in both UTC and local Perth time
- broader resurfacing for parked, not today, and rhythm-instance tasks
- repeating rhythm instance suggestions
- deadline and usefulness salience
- backup support for rhythm instances
- Clerk invite-only/public-signup operational verification if auth is enabled
- one visual/object-grammar pass to reduce generic card/pill/dashboard UI

That is the point where Life Rhythm can test the full capture-hold-suggest-re-enter loop.

### External tester trial

External tester trial should wait until:

- the daily loop is stable
- onboarding is clearer
- backup/export is trustworthy
- auth/privacy boundary exists and Clerk invite-only/public-signup settings are operationally verified
- Pool Holding Tray visual treatment and Task Pool language are stable
- visual polish is closer to the Soft Ledger / Holding Tray direction
- at least one personal trial has been completed
- language has had a non-clinical safety pass

The app should not be given to external ADHD testers while major daily-loop assumptions are still unstable.

## 17. Independent Preview and Non-Canonical Source Boundary

The independent/local preview zip is a prototype lab reference only. It should not be merged as source.

Use it for:

- UX inspiration
- flow ideas
- visual richness
- possible scheduler concepts
- design-board comparison

Do not use it for:

- production merge base
- persistence model
- backup/import behaviour
- scheduler authority
- trusted schema source

NotebookLM v1.2 documents are also non-canonical ideation. They should not be merged into product direction without classification and safety review.

Quarantined concepts from NotebookLM and benchmark sources include:

- physical-therapy model framing
- public wheelchair-model framing
- INCUP as neuroscience proof
- dopamine / norepinephrine / chemical-catalyst language
- medication peak overlays
- pharmacokinetic task scheduling
- wearable HRV / sleep / stress energy models
- automatic day rebuilding
- automatic rescheduling
- crisis detection from text or biometrics
- AI coach / agentic authority
- Sentry failed-SQL telemetry containing user content
- CRDT collaboration and sync-server assumptions before sync is contracted

The main GitHub repo remains the trusted implementation path.

## 18. Current Near-Term Roadmap

Completed foundation:

- Soft scheduling loop contract
- Task Pool schema and repository
- Task Pool capture UI and Pool/shared Pool panel list
- Visual design contracts
- Visual token foundation
- Research source governance docs
- Task Pool backup export and read-only validation with saved status and deferral metadata
- UTC/Perth verification and documentation reconciliation through PR #105

Current next implementation priority:

> Perform a fresh manual visual/product validation of the merged Pool → Plan → Today loop, then refine Pool, Plan and Today visual hierarchy before adding repeating rhythm instances.

Purpose:

Reduce generic AI-coded / SaaS / dashboard UI risk and align the app with the Soft Ledger / Holding Tray direction without widening product behaviour.

Next recommended sequence:

1. Complete a fresh desktop, narrow/mobile and keyboard walkthrough of Pool → suggestion → Plan placement → Today movement, recording concrete visual and interaction findings.
2. Refine Pool toward the Holding Tray / ledger-row visual direction.
3. Reduce Plan card soup and pill-chip overload enough that Plan does not feel like a dashboard.
4. Refine Today around one dominant active object with quiet secondary exits.
5. Repeating rhythm instance contract.
6. Repeating rhythm instance suggestions without backlog or streak debt.
7. Broader re-entry resurfacing for parked, not-today, and rhythm-instance tasks.
8. Deadline and usefulness salience.
9. Move/edit soft placement.
10. Backup support for rhythm instances.
11. Final non-AI prototype smoke QA and seven-day personal trial.
12. Operationally verify Clerk invite-only/public-signup settings before external testers.
13. Add a cloud sync contract only if later trial learning shows a clear need.

Cloud sync remains intentionally unimplemented.

## 19. Open Decisions

Open product and implementation decisions:

- What Holding Tray row treatment best signals safely held without backlog pressure?
- What secondary Settings/Reset affordance is calmest after removal from primary navigation?
- How much card/pill reduction is required before a meaningful personal product trial?
- How should repeating rhythm instances be generated without backlog or streak debt?
- How should resurfacing limits avoid alert fatigue?
- What operational Clerk invite-only settings are required before external testers?
- Should cloud sync be deferred until after a meaningful soft-scheduling product trial?
- Should AI wait until after scheduler/calendar basics?
- When should ADHD professional review be requested?
- Should external testers be invite-only from the start?
- Should move/edit soft placement be contracted or implemented next?
- What exact confirmation should be required before accepting askFirst placement?
- Should calendar load begin with manual blocks only, read-only `.ics`, or native integration later?
- When should import/restore execution be enabled, if ever?
- Should task history/completion logs exist before AI pattern observations?

## 20. Guardrails for Future PRs

Every future PR should state which boundary it touches.

Allowed current/future categories:

- docs only
- visual contract / token only
- visual shell alignment only
- settings write
- Library rhythm write
- active task write
- active task status write
- task pool write
- backup export
- backup validation preview
- read-only view model
- read-only scheduler suggestion
- user-confirmed soft placement write
- auth identity only
- cloud sync
- calendar read-only
- calendar write
- AI proposal only
- AI accepted-write path

High-risk categories require explicit contract first:

- auth
- backend
- sync
- calendar integration
- scheduler writes
- askFirst placement
- move/edit placement
- AI writes
- import/restore execution
- migrations
- task history/completion logs
- analytics
- notifications
- external telemetry
- medication, biometric, food, movement, money, crisis, or social-accountability features

Default rule:

> If a PR changes where user data goes, what writes happen, or who can see the data, it needs a contract first.

Codex prompts must be object-specific and boundary-specific. Do not ask Codex to “make the UI beautiful,” “make it more ADHD-friendly,” “polish the app,” or “add cognitive prosthetic UX.” Broad prompts are likely to create generic card/pill/dashboard UI.

## 21. Current Product Definition

Life Rhythm is currently best understood as:

> A local-first ADHD-optimised rhythm and re-entry app with calm task initiation, safe task holding, protected time, backup-safe persistence, opt-in signed-in local profiles, user-confirmed local soft placements, and a future soft scheduling loop based on task pool, open capacity, user confirmation, resurfacing, and usefulness windows.

It is not:

- a medical app
- a required-adherence app
- a gamified productivity app
- a calendar replacement
- an AI coach
- a cloud-synced app yet
- a public accountability system
- a full scheduler yet
- a biometric energy model
- a medication-timing system
- a crisis-detection system

The target user experience is:

> I can open the app, see one useful next action, protect parts of my life, do the minimum if that is what fits, park things without shame, and re-enter without a catch-up pile.

That is the design centre.
