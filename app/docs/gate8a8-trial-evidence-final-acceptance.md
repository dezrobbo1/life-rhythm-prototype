# Gate 8A8 — Trial Evidence and Final Acceptance

**Decision: GATE 8A8 — BLOCK. Gate 8B has not started.**

Reviewed `main`: `0f6ba19ad48b39d514d13e82e9fb80aee4434196`, merge of PR #166 (feature head `8fe90901014efa586c935a90622bb159ceff98ab`). Gates 8A1–8A7 are complete and merged. Branch: `feat/gate8a8-trial-evidence-final-acceptance`. The final PR head is identified in the live PR metadata and delivery report; a document cannot contain the SHA of the commit that contains itself. This record is preparation and acceptance evidence, not a Gate 8B start.

## Gate 8B evidence-source map

Categories: **A** existing factual application data; **B** safely derived from those facts; **C** deliberately sparse user report; **D** not measurable with sufficient integrity at present. Each outcome below has one primary category. Partial factual indicators do not silently upgrade a D or C outcome to an objective measurement. No analytics subsystem, cloud telemetry, content upload, psychological inference or new schema is introduced.

| Intended outcome | Category | Defensible source and limit |
| --- | --- | --- |
| Minutes spent planning | C | Prospective one-week ordinary-method baseline and approximate totals for four Life Rhythm weeks, with at least three weekly reports for a comparison. No app start/end record for planning sessions. |
| Number of manual scheduling actions | B | Count schema-valid `userPlacementCreated/Moved/Removed` and `schedulerRepairUndone` facts for the **recorded subset**. Protect and many other corrections lack a complete historical event; never label this count “all manual actions”. |
| Forgotten important intentions | C | Optional weekly incident report; an intention never captured cannot be detected from app state. |
| Invalid or conflicting placements | B | Validate accepted plan against current hard/protected authority and inspect rejected corrections/repair attention. This is a current-state/observed-incident measure, not a complete historical conflict rate. |
| Override / correction / Undo rate | B | Count the trusted recorded placement/Undo events and inspect explicit duration controls/current correction records with stated denominators. Protection history and all UI attempts are not complete. Do not report a universal override rate. |
| Initiation latency | D | `taskStarted.occurredAt` is factual, but no durable unambiguous “planned start as seen at initiation” pairing survives every repair/Today transition. A retrospective subtraction would invent precision. |
| Effort/time to recover after disruption | C | Brief weekly report when a real disruption occurs; repair events show plan changes, not the owner's effort or disruption onset. |
| Reduced Day burden and next-day re-entry | C | Brief report on naturally occurring use; current plan/day-mode and lifecycle facts do not measure felt burden or full longitudinal episodes. |
| Unnecessary **visible** schedule movement/churn | C | Report surprising/onerous movement. Scheduler move events are factual but do not prove the placement was seen or the movement unnecessary. |
| Clarification / interaction burden | C | One brief weekly impression or material incident; no complete interaction-count or time-on-screen ledger. |
| Perceived trust | C | Weekly 1–5 response, optional reason; subjective by design. |
| Perceived autonomy/control | C | Weekly 1–5 response, optional reason; subjective by design. |
| Continued voluntary use | C | Weekly yes/no and context; no passive session/adherence telemetry or streak target. |
| Whether learnt Normal duration improves an estimate without excessive correction | D | Eligible Normal samples, scheduler reservation/provenance and explicit controls are factual diagnostics. A reliable improvement claim needs a defined counterfactual and correction denominator unavailable today. Ask only whether the estimate felt useful when encountered; do not present that as causal improvement. |
| Task completion (secondary) | A | Trusted `taskCompleted` event and explicit variant evidence; unknown legacy/Stop forms stay unknown. Completion count is not the primary product outcome. |

The Gate 7A ledger records lifecycle and placement facts with local date/timezone and provenance. Gate 7B describes events; Gate 7E adapts only eligible explicit Normal template completions. `schedulerPlanState` is derived accepted state, not a portable longitudinal audit log. The protocol at [`gate8b-personal-trial-protocol.md`](gate8b-personal-trial-protocol.md) uses short weekly reports only for gaps and never asks the owner to recopy already recorded counts. Category D remains unmeasured. No trial-critical evidence gap justifies a new subsystem in this gate.

For category B counts, the protocol requires a checked Day 1 backup and exact start instant before first use, then an end backup: compare unique behaviour-event IDs and the four-week time window to exclude pre-trial history. A missing snapshot or deleted history makes the affected count incomplete. The prospective one-week baseline, four-week use window, minimum three weekly reports and fixed descriptive decision rule prevent an after-the-fact “usual week” from becoming invented evidence. These preparations belong to Gate 8B after Gate 8A8 PASS; they have not been carried out.

## Assembled-product acceptance matrix

The current source tree was exercised in a **controlled fake IndexedDB test namespace**, not with the owner's live data. A 24-file cross-layer focused matrix passed 471 tests in UTC and 471 in Australia/Perth. It exercises the listed paths, but cannot establish deployed, human-operated usability. “Automated pass / deployed unproven” is deliberately not an end-to-end acceptance PASS.

| Flow | Executed repository evidence | Result and remaining deployed proof |
| --- | --- | --- |
| A. Capture and task truth | `GlobalCaptureFlow`, `taskDefinitionRepository`, `Gate6DailyLoopAcceptance`; held outside Today, private plan authority, authored/fallback minutes, correction/reload | Automated pass; actual deployed capture/reload unproven |
| B. Rhythm end to end | `LibraryScreen`, `rhythmSchedulerIntegration`, `rhythmTodayRepository`; confirmation, plan/revision/instance identity, quota, placement, Today lifecycle, pause/off, one-off Add | Automated pass; actual deployed rhythm execution unproven |
| C. Usable day/calendar | `calendarAvailability`, `calendarAdapter`, `CalendarSourceControl`, `AppCalendarRepairPersistence`; reviewed bounds, work/travel/buffers, static recurring import, invalid-state preservation, hard/protected and blank-gap rules | Automated pass; all seven weekdays and controls on actual device unproven |
| D. Automatic plan/corrections | `schedulerPlanCoordinator`, `schedulerPlanStateRepository`, `placementCorrectionCoordinator`, `PersonalPlanReadState`; automatic authority, repair attention, Move/Protect conflict and Undo boundaries | Automated pass; deployed Plan/Why/Changed use unproven |
| E. Today execution | `TodayScreen`, `MinimumAchievementPersistence`, `behaviourEventRepository`, `rhythmTodayRepository`; terminal serialization, timer, Minimum/Normal/Full/Stop, Park/Not today, factual transaction | Automated pass; human Today use unproven |
| F. Reduced Day/re-entry | `gate5ReducedDay`, `taskReentry`, `ReentryActionsPersistence`, `rhythmSchedulerIntegration`; reduced demand, form substitution, non-debt recurrence/re-entry | Automated pass; ordinary disrupted-day usability unproven |
| G. Learning integrity | `durationLearning`, `behaviourEventRepository`, `rhythmTodayRepository`; Normal-only evidence, legacy unknown, controls/provenance and fallback | Automated pass; no new inference or learning mechanism |
| H. Portable recovery | `portableProfileBackup`, `PortableProfileRecovery`; export/check/reject, replace confirmation, stale preview, atomic restore, fencing, representative normal repository use after restore | Automated pass in throwaway namespace; no deployed human export/check/restore witnessed. Never replace the owner's only copy. |
| I. Reload/local-first | `AppShell.smoke`, capture/Today/recovery integration and portability cases; no AI dependency or cloud-sync claim | Automated pass; deployed reload and keyboard use unproven |

The existing Gate 8A7 executable tree had already passed the full **110-file / 1,370-test** suites separately in UTC and Perth, production build and diff check. The PR #166 merge tree is byte-identical to its final feature tree; this branch changes documentation only. Those full suites/build are reused under `AGENTS.md`, not rerun to imply fresh deployed acceptance. Focused Gate 8A8 matrix: **24 files / 471 tests passed** in each of UTC and Perth. No date/DST executable semantics changed; Sydney was not rerun.

## Browser and portable-recovery limits

Exact READY production deployment identified through Vercel: `https://life-rhythm-prototype-p6flvgrgx-daler-project-lr.vercel.app/app`, Git SHA `0f6ba19ad48b39d514d13e82e9fb80aee4434196`. **Attempted, not tested inside the app:** the cloud browser was redirected to Vercel login. The prior feature preview was likewise protected. A local Vite server started at `http://127.0.0.1:5173/app`, but the cloud browser returned `net::ERR_BLOCKED_BY_CLIENT`; no local Chrome/Chromium/Firefox/`agent-browser` executable was available. No authentication or network boundary was bypassed. The desktop, keyboard and genuine narrow/mobile walkthroughs are **unperformed**. There are no screenshots of actual app use to claim.

The whole-profile recovery assertions above used disposable test namespaces and normal repositories, including A→backup→B→rebuild, invalid rejection, stale-preview protection and atomic failure rollback. A deployed export/check/replace/reload demonstration is still required for PASS, using a throwaway profile and a separate safe copy. The owner's live profile must not be the destructive fixture.

## Owner-run acceptance sheet — issue #160

Run on the **same exact deployed build** selected for final Gate 8A8 review, at approximately **390 px portrait** or an actual mobile browser. Record stable URL, Git SHA, device, browser/version, viewport, timezone, authentication state and backup date. Use a disposable local profile for destructive recovery. Attach concise screenshots or recording with private content obscured, or record observed steps; component tests and a static mock do not count. Mark every row Pass/Fail/Blocked with the observed result and any issue link. Also repeat the ordinary loop at desktop width and with keyboard only.

| Narrow/mobile step | Result / evidence reference |
| --- | --- |
| Primary Today/Plan/Held/Library navigation; persistent Capture; no horizontal page overflow, clipped labels/actions or covered content | Pending |
| Capture a task; Held outside Today; feasible private plan; reload; variants and historic uncertainty | Pending |
| Setup: each of seven weekday assignments, reviewed usable hours, optional core-work period and cleared hours | Pending |
| Setup: work boundary, travel/transition and protected/recovery controls; save/repair consequences | Pending |
| Static recurring read-only calendar import/reimport, status and buffers; calendar never written; blank gap not capacity | Pending |
| Library: inactive suggestion, configure/enable, generated occurrence, pause/off/re-enable, one-off Add and preview-only Quick Pack | Pending |
| Today: exact rhythm occurrence, Start/Pause/Resume/Minimum/Keep going/Normal/Full/Stop, Park/Not today, no catch-up debt | Pending |
| Plan Day Line, Changed/repair, Move, Protect/Unprotect, Why this time, conflict explanation and safe Undo | Pending |
| Reduced Day and next-day re-entry when a safe representative state can be constructed | Pending |
| Whole-profile export/check, invalid rejection, explicit replace, reload and representative restored use in disposable profile | Pending |
| Touch targets, vertical forms, reachable disclosure, visible keyboard focus, no trap; modal Escape/focus return | Pending |
| Desktop ordinary loop and keyboard-only navigation/Capture/Today/Move/Protect/Why/Library/Setup/recovery | Pending |

**Evidence template:** local date/time and timezone; URL; deployed SHA; device/browser/version; viewport; profile namespace/throwaway status; each row's observed result; screenshots/recording reference; data effect; any blocker; reviewer and date. A PASS requires the current deployed product to be usable, not just the test harness. If a small blocker is found, correct and repeat affected acceptance; a larger redesign keeps Gate 8A8 BLOCK.

## Issue disposition and decision

- **#160 open, blocking Gate 8A8 PASS.** No genuine approximately 390 px/actual-device acceptance exists for the current build, and desktop/keyboard deployed checks are likewise unproven. Keep the issue open; the owner-run sheet above is the handoff. Do not close it on an automated test.
- **#146 open, not a Perth-only trial blocker.** The documented nonexistent/ambiguous internal wall-clock placement boundary rule is not independently fixed. Australia/Perth has no daylight-saving transition; any eventual Gate 8A8 PASS would be restricted to the owner's Perth-only environment, not DST-transition days or a DST-observing population. Do not close #146.
- **#141 open, governance-only.** Findings-only review handoff wording does not affect application data or scheduling. Do not fold it into this acceptance PR.

**GATE 8A8 — BLOCK.** Every pending row in the owner-run acceptance sheet, including deployed capture/task truth, rhythm execution, capacity/calendar, Plan/corrections, Today, Reduced Day/re-entry, whole-profile recovery, reload, desktop, genuine mobile/#160 and keyboard, must pass on an identified current build before this decision can change to PASS. None of those deployed flows was demonstrated in the available environment. The source tests and protocol cannot replace them. Gate 8B must not begin. No clinical or general-population readiness is claimed. The old PR #104 trial files remain historical.
