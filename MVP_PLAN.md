# Life Rhythm MVP Plan

Status: Current delivery plan
Historical reset baseline: main at e0c1d175e9082f7e5bdc5f1aeae6980146e4994b (PR #112); current programme state is recorded below.

## Current programme state

Programme authority: this file defines delivery sequence, owner-trial prerequisites and beta boundaries. PRODUCT.md defines product purpose; ARCHITECTURE.md defines target technical boundaries. Lower-level contracts refine a milestone and must not narrow these prerequisites.

Last verified main before PR #167 reconciliation: e57f900ae2d344e60247b468b74ad5e25e842197, merged PR #169 (authority correction). PR #166 remains the last executable change. Gates 0–7 and Gate 8A1–8A6 have delivered their recorded boundaries. Gate 8A7 delivered current-authority copy, selected disclosure and compact-shell alignment; whole-product calm/mobile acceptance is not complete.

Current active milestone: Gate 8A7B — whole-product calm-surface convergence. Open PR #167 prepares the Gate 8A8/Gate 8B evidence protocol and records readiness BLOCK; its current head is identified by the PR, not frozen here. Gate 8B has not started.

The remaining sequence is 8A7B — whole-product calm-surface convergence, then 8A7C — account-backed continuity, 8A7D — live read-only calendar, and revised 8A8 — integrated final readiness.

Current owner-trial blockers:

- calm/mobile product convergence, including observed clipped keyboard/form content and competing configuration/recovery surfaces;
- durable account-backed personal state, safe migration, reconnect/conflict handling and browser-clear/device-change continuity;
- one automatically refreshed live read-only calendar connection;
- integrated deployed desktop/mobile/keyboard/account/calendar/recovery acceptance on a known build;
- corrected prospective trial rules for voluntary use, equal windows and build-change attribution.

Owner personal trial means authenticated ordinary longitudinal use with durable account data, a local/offline replica where practical, one live read-only calendar, a calm/mobile daily surface, stable deployed build and trustworthy low-burden evidence. IndexedDB alone, manual export as normal continuity and static ICS as the whole calendar experience do not satisfy it.

Prototype exploration may use browser-local data, manual backups and static ICS with explicit limitations. It does not count as the longitudinal owner trial. Small beta means a separately approved invited external population after owner evidence, with supported device/provider/timezone boundaries and operational security/privacy, recovery, release and support readiness.

Issue #168 owns the active Gate 8A7B calm/mobile convergence blocker. Issue #160 has partial owner mobile evidence with observed FAIL; remaining rows and exact build attribution must be completed. Issue #146 blocks supported internal DST-transition populations, but need not block an explicitly Perth-only fixed-timezone owner trial. Issue #141 was closed by merged PR #169.

Explicitly deferred: public signup, calendar writes, broad provider coverage, simultaneous automatic multi-device merging, collaboration/social features, AI, notifications, content analytics, broader inferred preferences and clinical claims. Account-backed continuity and one live calendar are not deferred owner-trial requirements.

## MVP definition

The MVP is the first version that proves Life Rhythm can act as an external executive-function system rather than a manual task manager.

A user can:

1. give Life Rhythm real calendar commitments, tasks, rhythms and a small number of personal boundaries;
2. receive an automatically maintained private plan for the near term;
3. see a simple next-action view rather than operate the scheduling machinery manually;
4. have flexible internal work automatically repaired when circumstances change;
5. invoke Reduced Day and have the plan genuinely reduce demand;
6. use Minimum Done, re-entry and flexible rhythm semantics without creating catch-up debt;
7. move, defer, skip, protect or undo when the plan is wrong;
8. have those ordinary interactions recorded as future learning signals.

The MVP does not need AI or machine learning to prove this.

The defining product question is:

> Does Life Rhythm make fewer executive decisions necessary?

## MVP success criteria

The MVP is reached when the following end-to-end trial works with real personal data on a supported device/browser:

### Calendar reality

- The owner can connect at least one supported real read-only calendar provider used in ordinary life.
- Initial read and automatic refresh preserve stable external calendar/event/occurrence identity and process updates and deletions.
- Calendar changes trigger bounded private-plan repair without changing external events.
- Source freshness, permission failure and offline last-synchronised reality are visible and safe; unknown reality is not treated as free capacity.
- Known commitments and reliable hard logistics remain external constraints; blank gaps are not automatically productive capacity.
- Static ICS remains a supported import/fallback snapshot and does not satisfy the complete owner-trial live-calendar requirement.

### Canonical tasks and rhythms

- One-off tasks persist independently of the visible daily plan.
- Rhythms represent useful frequency/window intentions rather than accumulating missed-event debt.
- Tasks can express deadline/usefulness information and duration uncertainty.
- Eligible tasks may have Minimum Done / normal / fuller variants while remaining one underlying intention.

### Automatic private scheduling

- Life Rhythm can construct a valid near-term plan without requiring the user to confirm every placement.
- Hard constraints and explicit protected boundaries cannot be silently violated.
- The scheduler can choose among flexible tasks and rhythms using explicit rules/preferences.
- The solver/algorithm is behind a scheduling-domain interface so implementation can change without rewriting the product model.

### Adaptive repair

- When an important input changes, Life Rhythm can repair the flexible part of the plan automatically.
- Past time is frozen.
- Near-term placements have increasing movement cost or equivalent schedule-inertia protection.
- Replanning changes the smallest reasonable region instead of rebuilding the whole visible day unnecessarily.
- Every automatic internal change is inspectable and can be undone or corrected.

### ADHD-support mechanisms are part of the scheduler

- Reduced Day changes scheduling demand rather than merely changing presentation.
- Minimum Done can substitute for an eligible normal task when appropriate.
- Re-entry reevaluates unfinished work instead of blindly rolling everything forward.
- Recovery/protected time can compete with productive work.
- Flexible rhythms do not create punitive catch-up piles.

### Calm surface

The daily interaction should be able to reduce to approximately:

- Now;
- Later;
- Changed;
- Move / Not now / Minimum done / Protect / Undo / Tell me why.

The MVP does not require the current Today / Plan / Pool / Library structure to remain unchanged if a simpler surface better serves this loop.

Ordinary use prioritises one useful current action, quiet Later/Changed information and simple correction. Capture, Library, initial life shaping, relief and recovery must follow the same calm product direction. Necessary task minutes and authority distinctions remain truthful; specialist scheduler, storage and configuration controls use progressive disclosure.

Actual owner mobile forms and keyboard use must retain reachable primary inputs/actions without horizontal panning or clipping. Desktop and keyboard-only daily flows must also pass. This is trial-ready usability, not a requirement to reproduce every historical visual reference or polish every decorative detail.

### Behavioural foundation

- Relevant scheduling events are recorded as facts: planned, started, moved, completed, deferred, overridden, duration and sparse feedback where provided.
- Explicit preferences are stored structurally with provenance.
- The event model does not encode speculative psychological or physiological explanations.
- The data model is ready for simple later duration/preference learning without requiring ML in the MVP.

### Resilience and safety

- Core scheduling, tasks, rhythms and learning remain usable without an AI provider.
- A stable authenticated account owns durable acknowledged personal state. Clearing browser storage or changing supported browser/device can recover that state through sign-in and hydration.
- Local state is a replica/cache with safe offline queued writes where practical. Pending local changes are distinguished from server-acknowledged durability; reconnect never silently discards conflicting edits.
- Per-account authorization, account switching, schema compatibility, deletion/reset generations and legacy-profile migration preserve data isolation and integrity.
- Portable export/check/recovery remains available for independent portability and fallback. It is not the normal continuity mechanism.
- External calendar truth is never silently mutated by the private scheduler; destructive or externally consequential actions remain outside automatic authority.
- Local date/time behaviour is deterministic within the explicitly accepted population. Issue #146 must be resolved before supporting internal DST-transition placement semantics.
- Deployment and evidence identify frontend/backend/schema/configuration versions; readiness cannot be inferred from source tests alone.

## Delivery sequence

### Gate 0 — Product and repository reset

Goal: make the repository describe the product we are actually building.

Deliverables:

- `PRODUCT.md` as product authority;
- this `MVP_PLAN.md` as delivery authority;
- `ARCHITECTURE.md` as target technical direction;
- concise research translation in `docs/RESEARCH_BASIS.md`;
- rewritten `AGENTS.md` that protects true invariants but permits product experimentation;
- old product contracts/design specifications reclassified as historical/reference rather than future-product law.

Exit condition: a new agent can read a small set of files and correctly conclude that automatic private scheduling, calendar alignment and adaptive learning are central product hypotheses rather than prohibited scope.

### Gate 1 — Canonical life model and scheduler seam

Goal: create a coherent model the future scheduler can operate on without rewriting the whole application.

Work:

- inventory and reuse existing task, Pool, Today, placement, settings and rhythm code;
- define canonical scheduling-domain types for external commitments, internal intentions, rhythm requirements, protected windows, task variants and placements;
- create a scheduler interface independent of OR-Tools or any other solver;
- create translation/adapters from existing persisted records where safe rather than performing a broad destructive migration;
- define deterministic invariants and fixture scenarios.

Do not redesign the UI in this gate unless needed to exercise the domain model.

Exit condition: current data can be projected into one scheduling-domain model and a trivial deterministic scheduler can return a valid plan.

### Gate 2 — Real calendar read and usable-day model

Goal: schedule against real life rather than manually marked `openCapacity` alone.

Work:

- implement the calendar-adapter interface with at least one real read-only source;
- model external event identity separately from Life Rhythm internal placements;
- reuse the PR #112 day-profile foundation where useful for workday/non-workday and usable-day context;
- represent known travel/logistics as hard constraints where reliable;
- represent preparation/transition/recovery as explicit or soft/contextual overhead;
- derive candidate intervals from usable-day boundaries minus hard/protected constraints and uncertainty reserve;
- keep blank calendar time distinct from usable capacity.

Exit condition: Life Rhythm can generate candidate scheduling intervals from a real calendar and explicit life boundaries without requiring every capacity block to be manually drawn.

### Gate 3 — Automatic Scheduler v0

Goal: prove the core invention.

Work:

- implement a deterministic heuristic or constraint optimiser behind the scheduler interface;
- support hard feasibility, explicit protected boundaries, deadlines/usefulness, basic capacity limits, rhythms and soft preferences;
- automatically place private flexible tasks/rhythms;
- generate a stable near-term plan;
- show short provenance for why a placement exists;
- add strong fixture and property-style tests for impossible overlaps and boundary violations.

Exit condition: tasks and rhythms can be automatically placed around real commitments with no per-placement confirmation loop.

### Gate 4 — Rolling repair and schedule inertia

Goal: remove repeated manual replanning.

Work:

- add event-driven replanning triggers;
- preserve the past and strongly preserve the near future;
- add movement cost/schedule inertia;
- repair only the necessary flexible region;
- support automatic private rescheduling after calendar changes, overruns, missed starts, completion changes and explicit user corrections;
- provide one-step undo and a concise Changed view.

Exit condition: a disrupted day can be repaired with substantially less manual intervention than the current soft-placement workflow.

### Gate 5 — Reduced Day, Minimum Done, rhythms and re-entry

Goal: ensure the scheduler behaves like Life Rhythm rather than a generic optimiser.

Work:

- integrate Reduced Day into scheduling objectives/capacity rules;
- preserve essentials and user-identified stabilising/restorative activities where appropriate;
- allow Minimum Done substitution without duplicating the task;
- model flexible rhythm windows/frequency and non-accumulating recurrence semantics;
- reevaluate missed/unfinished work by usefulness, deadline and purpose;
- prevent blanket catch-up debt;
- protect recovery as a legitimate scheduling objective.

Exit condition: low-capacity and disrupted-day flows require less executive work and do not create a punitive backlog explosion.

### Gate 6 — Calm daily surface

Goal: make the powerful scheduler feel simple.

Work:

- validate whether existing Today / Plan / Pool / Library navigation still helps;
- optimise for Now / Later / Changed rather than exposing internal scheduling objects by default;
- keep capture fast;
- make corrections low-friction;
- keep explanations short, grounded and optional;
- retain accessibility, keyboard and mobile requirements.

Do not preserve existing object grammar merely because it is documented. Reuse good visual work where it serves the MVP.

Exit condition: the user can operate the day without understanding Pool status, placement machinery, solver concepts or internal state boundaries.

Status (Gate 6F, 2026-09-22): **Complete.** Gate 6A–6F and the final owner-provided approximately-390-pixel portrait mobile-browser acceptance are complete, as recorded in `app/docs/gate6-exit-report.md`. Desktop, keyboard, and mobile acceptance pass, and the ordinary daily loop can be operated without understanding scheduler internals. Issue #146 remains an explicit DST-boundary limitation and issue #141 remains governance-only follow-up work; neither prevents Gate 6 exit. Gate 7 — Behavioural Learning v0 followed as the next milestone; its current status is recorded below.

### Gate 7 — Behavioural Learning v0

Goal: make Life Rhythm start learning without building a machine-learning platform.

Status (Gate 7 exit review, 2026-09-25): **Complete — PASS.** Gate 7A records trusted observed behaviour; Gate 7B derives transparent descriptive statistics; Gate 7C–7D establish explicit-preference authority, live scheduling integration and user controls; Gate 7E adds the first bounded scheduler-adaptive learning capability by using trusted template-linked completion history to improve Normal duration reservations. The learnt choice is explainable through persisted provenance and correctable through per-template disable, user correction and reset controls. The exit evidence and remaining follow-ups are recorded in `app/docs/gate7-exit-report.md`.

Gate 7E deliberately does not infer preferred time-of-day, category-level duration, psychological cause or broader behavioural tendencies. Repeated-move inference, recency/decay, subjective restoration learning and a broad learnt-about-me surface remain possible later work, but are not prerequisites for Gate 7 exit.

Broader candidate work (not all required for exit):

- actual-duration statistics and uncertainty ranges;
- repeated-move/rejection statistics;
- time/context acceptance statistics;
- explicit preference hierarchy;
- source/provenance and basic confidence;
- recency weighting or simple decay;
- sparse enjoyment/restoration/activation feedback only when useful;
- a `What Life Rhythm has learnt about me` view with correct/reset/delete controls.

No contextual bandits, reinforcement learning, neural network or psychological personality model is required.

Exit condition: at least a small set of scheduling choices can improve from the user's own history while remaining explainable and correctable.

### Gate 8A — Owner Personal-Trial Platform Readiness

Status: **BLOCK.** The delivered prototype has not yet met the owner-trial definition in Current programme state. Gate 8B baseline and Day 1 must not begin before an explicit integrated 8A8 PASS.

Delivered slices, retained with their actual scope:

1. **8A1 — Canonical Input Truth:** authored variant minutes, exact fallback and safe correction; preserve historical authorship uncertainty.
2. **8A2 — Rhythm End-to-End:** configured flexible quota, stable plan/revision/instance identity, private scheduling and exact Today/history lifecycle. Anchored cadence remains deferred.
3. **8A3 — Usable-Day Setup and Static Calendar Safety:** reviewed day/weekday/work/travel authority and bounded recurring ICS. This does not establish a live provider connection.
4. **8A4 — Local Profile Portability and Recovery:** versioned whole-profile export/check and replace-only atomic recovery with generation fences. This does not establish account-backed durability or sync.
5. **8A5 — Scheduling Mutation Integrity and Corrections:** transactional repair attention, durable Move/Protect, truthful explanations and safe Undo boundaries.
6. **8A6 — Learning Evidence Integrity:** explicit completion variants and trusted Normal-only template learning, including concrete rhythm occurrences; legacy unknown remains unknown.
7. **8A7 — Surface Authority Alignment:** current copy, selected disclosure and compact shell, delivered by PR #166. Whole-product calm/mobile readiness remains below.

#### Gate 8A7B — Whole-product calm-surface convergence

Goal: make ordinary use feel like the intended V0 product on the owner's actual mobile device and on desktop/keyboard.

Dependencies: corrected roadmap; current input, lifecycle, correction and learning contracts.

Bounded implementation PRs:

- **B1:** quiet shell/utilities and Capture composition, including real mobile keyboard reflow. Preserve necessary authored action/minute truth; defer secondary classification and optional detail where safe.
- **B2:** compact Library shelf/rows and contextual rhythm actions; initial life-shape setup separated from advanced settings; one ordinary portability/recovery entry with legacy inspectors disclosed.
- **B3:** populated Today/Plan/Changed, simple correction and contextual relief consistency; integrated mobile/desktop/keyboard acceptance of the converged surface.

Data/migration work: no migration merely for styling. If a form or state model change requires persisted semantics, isolate its schema/compatibility contract and preserve existing records.

Human acceptance: actual mobile portrait with keyboard, readable primary actions without horizontal panning/clipping, populated Now and quiet exits, Capture save/reload, rhythm enable/occurrence/execution, seven-day setup, Plan repair/correction, Reduced Day/re-entry and safe recovery; desktop and keyboard-only focus/activation/Escape/return. Record exact build and each result.

Automated validation: focused component/integration tests for changed interactions and relevant truth/repair boundaries; required full test/build checks for the changed source. Test outcomes do not replace human acceptance.

Exit: observed mobile defects fixed; necessary ordinary choices have clear priority; specialist machinery is disclosed; all scoped human paths pass. Owns the convergence defects separated from #160 and completes or transfers #160's evidence rows without losing them.

Non-goals: scheduler rewrite, invented task defaults, wholesale new navigation, literal duplication of every design board, AI, account sync or provider implementation inside these UI PRs.

#### Gate 8A7C — Account-backed durable personal state

Goal: ordinary continuity belongs to the authenticated account and survives browser clearing and sequential device change.

Dependencies: reviewed auth/storage/sync data-flow contract; current canonical-class inventory; 8A7B ordinary-surface conventions.

Bounded implementation PRs:

- **C1:** select and document the smallest coherent backend against current Clerk integration and deployment needs; implement verified account authorization/isolation, schema/revision boundary and auth-required deployed configuration. No silent local fallback on misconfiguration.
- **C2:** server persistence and clean-client hydration; explicit migration of an existing local profile with preview, consent, safe copy, server acknowledgement and compatibility checks. Include every required canonical class and discard/rebuild derived plan authority safely.
- **C3:** durable local outbox/idempotency, offline writes/reconnect, revision conflict preservation, account switching, deletion/reset fencing, portability/recovery and offline-use acceptance.

Data/migration work: explicit account ownership, server schema version, operation IDs/revisions, local replica/outbox migration and reset generations. Portable-v1 is an import/export format, not an automatic live sync protocol. Preserve unknown historical evidence and immutable occurrence provenance.

Human acceptance: sign in to restricted account; save and confirm synced state; clear browser data and recover; hydrate a clean second browser/device; queue offline changes and reconnect; reject a competing revision without losing either side; switch accounts safely; demonstrate deletion and throwaway recovery without resurrected data. Record the supported offline bootstrap path.

Automated validation: verified/expired/forged token handling, second-account denial, transactional canonical/outbox writes, idempotent retries, stale revisions, interrupted migration, incompatible clients, delete/reset resurrection prevention, scheduler repair fences and complete canonical round trip.

Exit: acknowledged account state survives clear/device change; unsent state remains visible and recoverable; local/remote conflicts never silently overwrite; account data are isolated; no credentials in normal profile/export; migration/deletion/recovery pass. Creates and owns a dedicated account-continuity issue.

Non-goals: public signup, collaboration, simultaneous automatic multi-device merge/CRDT, content telemetry, general admin task browsing, native application rewrite or AI. Sequential supported-device use and explicit safe conflict handling are required.

#### Gate 8A7D — One live read-only calendar connection

Goal: scheduling reacts to automatically refreshed real calendar reality.

Dependencies: 8A7C authenticated account, server secret/deployment boundary and canonical revision/repair model; owner selection of a provider actually used in ordinary life.

Bounded implementation PRs:

- **D1:** one provider OAuth/read-only connection, private token lifecycle, selected calendar identity, bounded initial sync and normalized external event/series/occurrence identity.
- **D2:** automatic foreground/focus refresh, update/delete/recurrence handling, freshness/error/offline state, bounded retry/full-resync and source-change repair integration.

Data/migration work: versioned connection/source/event/cursor metadata distinct from raw ICS records; existing static source remains an explicit snapshot/fallback and is not silently converted into credentials or a live account connection. Provider tokens stay outside canonical personal exports.

Human acceptance: create/move/delete a real provider event and change a recurrence exception; see Life Rhythm refresh and valid repair within the declared supported freshness bound. Revoke permission, reconnect and use last-synchronised state offline safely. Verify no external event writes. Resolve provider testing/consent/token-lifetime limits that would interrupt normal four-week use.

Automated validation: pagination, identity stability, cancellations/deletions, recurrence exceptions, all-day/timezone conversion, horizon extension, token/cursor invalidation, stale responses, rate/error backoff and atomic source-plus-repair attention. Retain ICS resource-safety tests.

Exit: one owner's real supported provider refreshes automatically; changed calendar reality triggers trustworthy repair; offline/stale/failed state is honest and conservative; token/identity lifecycle and no-write boundary pass. Creates and owns a dedicated live-calendar issue. #146 remains separately gated by supported internal timezone population.

Non-goals: external writes, broad provider support, email access, webhooks/push/background infrastructure unless needed to meet accepted freshness, calendar replacement or arbitrary recurrence expansion.

#### Gate 8A8 — Integrated final owner-trial readiness

Goal: accept the assembled intended trial product and freeze an attributable evidence environment.

Dependencies: 8A7B/C/D exits; corrected protocol; no unresolved owner-trial blocker. Rework PR #167's prepared record/protocol to this definition.

Scope: current deployed task/rhythm authoring/execution, calendar freshness/repair, corrections, Reduced Day/re-entry, learning meaning, account continuity/offline/conflicts, safe export/delete/recovery and ordinary calm-surface use. Accept actual mobile, desktop and keyboard. Verify access policy and deployment version/configuration, not only a READY preview label.

Data/migration work: no exploratory schema changes in acceptance; verify deployed compatible versions and migration results. Use throwaway state for destructive recovery, never the owner's only durable copy.

Human acceptance: every applicable matrix row is Pass on an identified integrated build. Failed/blocked rows retain blocker disposition. Completing or closing an evidence issue does not change a failed product result to PASS.

Automated validation: required full suites/build for changed source; relevant timezone controls; API/isolation/sync/provider integration tests; reuse valid unchanged evidence rather than rerunning for status alone.

Exit: explicit PASS with exact frontend/backend/schema/configuration versions, stable authenticated origin, accepted devices/provider/timezone, safe recovery and all trial prerequisites. Otherwise BLOCK. No baseline or Day 1 is authorised by a prepared protocol alone.

Gate 8A exit condition: integrated 8A8 PASS demonstrates the owner's defined account-backed, live-calendar, calm/mobile product; tasks/rhythms, scheduler/learning facts and recovery are trustworthy. Prototype feedback may continue with explicit limitations and does not count as longitudinal trial evidence.

### Gate 8B — Longitudinal owner personal trial

Status: **Not started.** Entry requires 8A8 PASS and the owner selecting the accepted stable environment. Baseline preparation is part of 8B and must not begin while 8A8 is BLOCK.

Goal: evaluate whether ordinary use reduces executive/planning burden while preserving trust and control. Task completion is secondary; no clinical or causal efficacy claim follows.

Protocol: one prospective seven-day baseline using the owner's ordinary planning method, followed by four consecutive equal seven-day Life Rhythm reporting windows (28 days total). Record exact start/end instants and local timezone before use. Use one numeric weekly planning/replanning-minute estimate and fixed 1–5 trust/control questions, plus sparse material incidents. No mandatory daily research form or activity quota.

Positive signal requires ordinary voluntary use throughout the observation period, at least three of four numeric weekly reports, no stop condition or material recurring conflict/churn/pressure, and the predeclared planning-burden and trust/control rules. Explicit cessation because the product is burdensome or unwanted is no positive signal; unrelated interruption or insufficient evidence is inconclusive. Missing reporting is not evidence of continued voluntary use. Record voluntary-use status for each window and the end-of-period decision separately.

The protocol must predeclare practical decision thresholds before baseline. The prepared 15-minute and 20% reduction thresholds may be retained only as owner-approved feasibility criteria, not research-validated clinical thresholds. Missing numbers remain missing; no retrospective midpoint or changed threshold.

Evidence: preserve a checked starting ledger snapshot/ID cursor and end snapshot, excluding pre-trial history; avoid duplicate synchronized event counting. Facts, bounded derivations, sparse self-report and unavailable outcomes remain separate. No general override/Undo rate without a matched denominator, no robust initiation-latency estimate or causal learnt-duration improvement claim from current events.

Build rule: any change affecting scheduling, canonical/sync/calendar behaviour, learning, burden-bearing UI or evidence semantics invalidates the pooled stable-build comparison. Pause and reaccept the relevant readiness paths, then restart baseline and the 28-day window for a new primary comparison, or report the old run as segmented/inconclusive. Do not aggregate across affected versions. A demonstrated non-behavioural change may be recorded without restart with explicit rationale. Ordinary provider event changes are normal use, not product-build changes. Supported device change under the same account/build is recorded and does not automatically restart evidence; unsupported timezone/provider/configuration change requires readiness reassessment.

Pause conditions: suspected lost/cross-account data, invalid hard/protected placement, unsafe or persistently stale calendar reality, failed continuity/recovery, unreliable event attribution, or material pressure/loss of control. Preserve safe evidence, diagnose the bounded mechanism and reaccept affected paths. Routine offline use within the accepted degraded boundary is not itself a stop condition. Product-driven cessation precludes a positive result; unrelated interruption is reported as inconclusive rather than failure of the person.

Exit: report positive signal, no positive signal or inconclusive using the predeclared rule; retain incidents, conflicts and disagreement between indicators. The owner makes a separate next-product/release decision. This does not launch beta automatically.

### Post-8B — Small-beta readiness and separate release decision

Goal: safely support a small invited external population after owner evidence.

Dependencies: reviewed 8B result; explicit release decision and supported population.

Scope: invited onboarding/account lifecycle; shared-device/cross-account isolation; supported device/provider/timezone matrix; operational privacy/security/data-access review; backup/recovery; support/escalation; content-minimized monitoring; release/rollback and incident practices.

Data/migration work: tested versioned upgrades and deletion/retention across supported accounts; operational restore without account mixing. Resolve #146 before accepting internal DST-transition populations.

Human acceptance: independent invited tester can sign in, connect the supported provider, start ordinary use and recover without developer tooling; supported devices and timezone boundaries pass.

Automated validation: relevant isolation/migration/provider/timezone regressions and required source checks; operational recovery/release exercises.

Exit: separate beta release approval with verified support/security/operations and supported population. A Perth-only owner PASS is not general-population readiness.

Non-goals: public signup, broad provider coverage, calendar writes, AI, notifications, social features or collaboration unless separately justified and approved.

## Explicit MVP non-goals

Do not block the owner-trial product on an LLM, managed/BYO AI, local LLM, bandits/reinforcement learning, broad inferred behaviour, cloud behavioural models, public signup, collaboration/social features, notifications, email/message sending, external calendar writes, broad multi-provider coverage, content analytics, clinical/health-state inference, concurrent automatic multi-device merging, literal reproduction of every historical screen or decorative perfection.

Required owner-trial capabilities are not non-goals: authenticated account-backed continuity, one live read-only calendar, trial-ready calm/mobile usability, safe data migration/reconnect/recovery and stable deployed acceptance. Local-first does not mean browser-only durability. Portability remains a safety mechanism rather than normal continuity.

## After MVP

## After MVP

### Optional AI v1

Add conversational capture, task decomposition, natural-language preference capture, ambiguity handling, schedule explanations and summaries of observed patterns through typed validated commands.

### Experimental personalisation

Use opt-in within-person/micro-randomised experiments for genuinely uncertain strategies such as quick-win sequencing, movement-before-task and alternative timing policies.

### Later learning

Consider contextual bandits only when event quality, safe candidate actions and proximal outcomes are mature. Full reinforcement learning remains out unless simpler methods demonstrably fail and a defensible objective exists.

### Commercial AI

If AI proves useful, managed Life Rhythm AI is the preferred first commercial path. Provider-neutral developer/BYO access can follow for users willing to manage credentials and billing.
