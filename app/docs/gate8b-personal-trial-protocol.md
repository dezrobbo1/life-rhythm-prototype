# Gate 8B — Longitudinal Owner Personal Trial Protocol (prepared, not started)

**Status: preparation only. Gate 8A8 is BLOCK; no baseline or Day 1 has begun.** This document becomes usable only after an explicit integrated Gate 8A8 PASS on the supported account-backed, live-calendar, calm/mobile product. Merging this protocol does not authorize Gate 8B.

## Question, population and exact observation windows

The single-owner, non-clinical product question is whether ordinary Life Rhythm use reduces executive/planning burden while preserving trust and control. Task completion is secondary. This observation does not establish causality or treatment efficacy and imposes no adherence quota.

After 8A8 PASS, record **one prospective seven-day baseline** using the owner's ordinary planning method before Life Rhythm Day 1. Record its exact start/end instants, local dates/timezone, one approximate **numeric total in planning/replanning minutes**, the fixed trust/control questions below and material unusual context. A non-representative or missing baseline makes the planning comparison inconclusive; do not reconstruct a “usual week” after Day 1.

Then pre-record the exact Day 1 start instant and **four consecutive equal seven-day Life Rhythm windows (28 days total)**. Window 1 starts at Day 1; window 2 starts exactly when window 1 ends, and likewise through window 4. Each window is a half-open interval `[start, end)` of seven 24-hour days measured by instants, with local dates/timezone shown for reporting. Assign each weekly report and factual event to its exact interval. A partial calendar week cannot be compared with the seven-day baseline. Record the final end instant before use begins. A local DST transition requires a separately accepted population/semantics under #146; the initial explicitly Perth-only fixed-timezone scope does not resolve #146.

Use the same question and anchors at baseline and at each window end; higher means better:

| Rating | Question | 1 | 5 |
| --- | --- | --- | --- |
| Trust | How much did you trust your planning system to reflect reality this week? | Not at all | Completely |
| Autonomy/control | How much did you feel in control of your plan this week? | Not at all | Completely |

## Predeclared descriptive decision rule

Obtain at least three of four **numeric** weekly planning-minute totals and compare their median with the prospective numeric seven-day baseline. The prepared practical positive-signal thresholds are both **at least 15 fewer minutes per week** and **at least 20% fewer minutes**. Treat them as owner-reviewed product-feasibility thresholds before baseline, not clinical or research-validated cutoffs. Do not change them after observing results. Optional ranges or confidence notes never replace a numeric estimate; do not choose a range midpoint retrospectively.

A **positive signal also requires ordinary voluntary use throughout all four windows**, explicit voluntary-use status for each window and at the end, no pause/stop condition or material recurring conflict/churn/pressure, and neither median trust nor median control falling more than one point below its baseline rating. Three numeric reports are enough for the minute comparison only; a missing report is **not** evidence of continued voluntary use. Seek a sparse separate status for a missing window; if voluntary use cannot be established, do not report a positive signal.

If the owner stops or continues only under pressure because Life Rhythm is burdensome, confusing, unwanted or otherwise product-driven, report **no positive signal**. This is product evidence, not user failure. An unrelated interruption preventing fair observation, missing baseline, baseline under 15 minutes, insufficient numeric reports, unestablished voluntary use, or non-comparable conditions yields **inconclusive**, not an invented positive result. Other completed but unmet product thresholds yield **no positive signal**, with incidents and conflicting indicators reported. This single-owner before/after result does not authorize beta automatically.

## Stable environment and Day 1 record — fill only after 8A8 PASS

The accepted environment is a stable authenticated deployed origin with account-backed acknowledged state and a local replica/cache. The owner may use accepted sequential devices under the same account/build; browser IndexedDB and manual export are not normal continuity. Record without secrets:

| Field | Day 1 record |
| --- | --- |
| Integrated Gate 8A8 PASS link, exact acceptance date and supported population | Pending |
| Stable deployed URL and exact frontend Git SHA/version | Pending |
| Backend/API deployment identifier, server schema/protocol version and relevant configuration version | Pending |
| Authenticated owner account identifier (private evidence, no tokens) | Pending |
| Primary device/browser/version/viewport/timezone; accepted sequential-device scope | Pending |
| Supported live read-only provider/account/calendar selection, last successful refresh and freshness state, with no credentials | Pending |
| Confirmed external-calendar no-write boundary | Pending |
| Portable fallback export/check date and independently safe copy location | Pending |
| Baseline start/end instants, numeric minutes, trust/control and unusual context | Pending |
| Four exact seven-day window start/end instants, Day 1 UTC instant and local date/timezone | Pending |
| Checked starting canonical event-ledger snapshot/ID cursor and schema/provenance version | Pending |

Before first trial use, verify normal account save/hydration, supported offline/reconnect behaviour and fresh live calendar reality already accepted by 8A8. A checked portable export is independent fallback/recovery evidence and a possible safe copy, not the everyday way to switch browsers. Use throwaway data for destructive restore/delete demonstrations; do not replace the owner's only acknowledged copy. Static ICS remains an optional snapshot/import fallback and does not satisfy the live provider prerequisite. No external calendar writes are required.

## Trusted event attribution across local replicas

Record the exact Day 1 start instant and a checked starting ledger snapshot or stable event-ID cursor before first use, then an end snapshot. Count each unique **canonical acknowledged** schema-valid event once within the four exact intervals, regardless of how many local replicas receive it. Exclude all pre-trial IDs without deleting history. Preserve event occurrence time/local timezone separately from server receipt/synchronization time; late sync receipt alone does not turn a pre-trial event into a trial event. Distinguish queued/unsynced records from acknowledged ones and report unresolved attribution honestly. Missing/deleted history, incompatible provenance or ambiguous clocks makes the affected count incomplete, not reconstructed.

The Gate 7 ledger supports only bounded descriptive placement/Undo counts for its recorded subset and factual completion variants. There is no matched opportunity denominator for a general override/correction/Undo **rate**. No robust initiation-latency or causal learned-duration benefit claim follows from current facts. Do not create a new analytics subsystem or publish private task content.

## Ordinary use and sparse reports

Use Life Rhythm ordinarily: Capture, Now/Later/Changed, task and rhythm execution, Move/Protect/Why/Undo, Reduced Day and re-entry when useful. Do not manufacture events, completion variants or a daily adherence target. No mandatory daily questionnaire.

At the end of each exact seven-day window, take at most about two minutes to record:

- one approximate **numeric total** of planning/replanning minutes for that interval; an optional range/context note can accompany but cannot substitute for the number;
- trust and autonomy/control using the same anchored questions;
- whether use remained ordinary and voluntary during **that entire interval**, with sparse context and whether use ceased;
- material forgotten-intention, disruption, Reduced Day/re-entry, visible-churn, calendar-staleness or clarification burden only if encountered;
- whether a learned Normal reservation felt useful or required repeated correction, only if encountered and without a causal claim.

At the end of window 4, separately record whether use remained voluntary through the observation period and the predeclared positive/no-positive/inconclusive decision. Missing weekly reporting never counts as a “yes.” The application records many facts; do not manually recopy event counts. Use a concise private incident log with local time/timezone, exact build/backend/configuration, device, expected/actual effect, severity, preserved safe copy and issue/disposition, without unnecessary task content.

## Build and deployment invalidation rule

Any deployment/source/configuration change affecting scheduler behaviour, canonical persistence/sync, live calendar/provider, learning, burden-bearing UI/workflow or evidence semantics invalidates a pooled stable-build comparison. **Pause** the primary run, reaccept the affected Gate 8A8 paths and either (1) start a fresh prospective seven-day baseline followed by four new equal seven-day windows on the new accepted build, or (2) preserve the earlier observations as segmented/inconclusive. Never pool affected versions to claim one positive signal. Record exact old/new frontend, backend, schema/protocol and configuration identities and the reason for classification.

A demonstrated non-behavioural documentation/metadata-only change may be recorded without restart with explicit rationale. Ordinary changes to external provider events through normal live use are calendar reality, **not product-build changes**. Supported sequential-device use under the same accepted account/build does not automatically restart evidence. A change of unsupported provider, timezone or deployment conditions requires renewed readiness assessment.

## Pause and safety conditions

Pause evidence, preserve safe state and record an incident for suspected lost/cross-account data; failed hydration, migration, deletion or recovery; rejected/overwritten offline work; a hard/protected placement violation; persistently stale/unsafe provider reality or unintended external calendar write; a plan shown as trustworthy despite failed repair; incorrect learning provenance; material churn, pressure or ordinary-action obstruction; or unreliable event attribution. Routine offline use within the accepted degraded boundary is not itself a stop condition. Diagnose and reaccept affected paths before restarting or segmenting evidence under the rule above. Do not interpret a product-driven stop as user failure.

The [Gate 8A8 prepared BLOCK record](gate8a8-trial-evidence-final-acceptance.md) is the future acceptance handoff. PR #104-era trial files are historical only. Gate 8B remains not started.
