# Gate 8B — Longitudinal Personal Trial Protocol (prepared, not started)

**Status:** preparation only. Gate 8A8 is BLOCK until its final acceptance record passes. This protocol does not authorise Day 1.

## Classification and question

This is an initial single-owner, longitudinal, non-clinical product trial. Its primary question is whether ordinary Life Rhythm use reduces executive and planning burden while preserving trust and control. Task completion is secondary. It is not an ADHD treatment study, a productivity competition, or an adherence programme. No clinical, dopamine, neurological-state or optimal-schedule claim follows from it.

After Gate 8A8 PASS, record **one prospective baseline week** of the owner's ordinary planning method before Life Rhythm Day 1, then **four calendar weeks** of ordinary Life Rhythm use. Do not reconstruct a “usual week” from memory after use starts. For the baseline week, make one approximate **numeric total in minutes** for planning/replanning, one trust and one autonomy/control rating using the fixed questions below, and a short note about any unusual disruption; no daily research form is required. Record the seven-day dates and whether the week was representative. If that baseline cannot be obtained, the planning-minute comparison is inconclusive. Baseline preparation and Day 1 are Gate 8B activities and must not start while Gate 8A8 is BLOCK.

Use these **same questions and anchors** for the prospective baseline and every weekly Life Rhythm report; higher always means better:

| Rating | Question | 1 | 5 |
| --- | --- | --- | --- |
| Trust | How much did you trust your planning system to reflect reality this week? | Not at all | Completely |
| Autonomy/control | How much did you feel in control of your plan this week? | Not at all | Completely |

Before use, predeclare the descriptive decision: obtain at least three of the four weekly use reports and compare the median of their **numeric minute estimates** with the prospective numeric baseline. A practical positive signal requires both **at least 15 fewer minutes per week and at least 20% fewer minutes**, no trial stop condition, no material recurring conflict/churn burden, and neither trust nor autonomy/control falling by more than one point from baseline in the median weekly report. Otherwise report “no positive signal” or “inconclusive” when data are missing, the baseline is under 15 minutes, or the week is not comparable. Do not move the threshold after seeing results. This single-owner before/after observation does not establish causality or treatment efficacy; inspect incidents and voluntary use alongside the minutes, and preserve disagreement between indicators.

## Stable environment record before Day 1

Fill this only **after** Gate 8A8 records PASS on the exact build and the owner selects a stable deployment. A Vercel preview URL is not a substitute for a stable trial origin: local-first browser state is origin-specific. Sign-in selects a local namespace; it is not cloud sync.

| Field | Day 1 record |
| --- | --- |
| Gate 8A8 PASS record and accepted population | Pending |
| Stable deployed URL and exact deployed Git SHA | Pending |
| Primary device, browser/version, viewport and timezone | Pending |
| Authentication enabled? Signed-in account/namespace without recording secrets | Pending |
| Portable profile export/check date and separate safe copy location | Pending |
| Supported calendar source/reimport date, if used | Pending |
| Prospective baseline seven-day dates, one approximate numeric weekly planning-minute total, trust/control ratings using the fixed questions and unusual context | Pending |
| Day 1 exact UTC instant, local date/timezone, checked backup and its behaviour-event ID set | Pending |

Keep one stable URL and one primary browser/device during the evidence period. Record any build, URL, browser, device or timezone change as a protocol deviation; do not merge measurements across origins as though they shared local data. Back up before any deliberate local-data replacement. Never use the owner's only live profile as a destructive restore fixture.

## Day 1 setup, once

1. Review usable-day hours and all seven weekday assignments. Record the optional core/work period or that it is cleared, work boundaries, currently implemented travel/transition controls, and protected/recovery time. Blank calendar gaps never create capacity.
2. If relevant, import a supported static read-only `.ics` source, inspect status and buffers, and plan to re-import when the source changes. Life Rhythm does not write external events.
3. Capture one ordinary task with truthful Minimum/Normal/Full actions and minutes; verify that it is held outside Today while eligible for private planning when feasible. Correct historic uncertain minutes rather than assuming their authorship.
4. Configure and enable one personal rhythm from a suggestion or custom entry; inspect a generated occurrence. A catalogue suggestion or Quick Pack preview is not active recurrence. Add to Today once does not turn recurrence on.
5. Inspect explicit scheduling preferences and duration-learning controls only where relevant. An override outranks learned evidence; legacy/Full/Stop completions do not supply Normal-duration samples.
6. Export and **check** a whole-profile portable backup. Understand that restore is replace-only, requires confirmation, and is not cloud sync.

Immediately before first trial use, preserve that checked backup as the **Day 1 ledger snapshot** and record the exact UTC start instant and local date/timezone. For event-derived trial counts, compare `data.behaviourEvents[].id` in the end-of-trial checked backup with this snapshot and count only new schema-valid event IDs recorded during the four-week trial window. Existing historical IDs are excluded without deleting or rewriting them; use event occurrence time/local date to inspect the window, while ID difference prevents old events from being counted merely because the general statistics reader includes them. Record the end instant and backup. If behaviour history is deleted, a backup is missing, or the device clock makes attribution ambiguous, label the affected count incomplete rather than inventing it. Placement/Undo counts remain the recorded subset described in the Gate 8A8 evidence map.

## Ordinary use

Use Life Rhythm as the planner, not as a daily research form. Capture when something needs remembering; use Today/Now/Later, Start/Pause/Resume, Minimum Done, Normal/Full Done or Stop here as they naturally arise. Use Park, Not today, Move, Protect, Reduced Day, re-entry, Library rhythms and Why this time when genuinely useful. Do not manufacture events, complete an artificial quota or choose a completion button to influence learning. Normal and Full are explicit execution facts; Minimum is a separate milestone; Stop leaves the exact completed form unspecified.

No mandatory daily questionnaire. Record a short incident only when something materially increased burden, surprised the owner, conflicted with reality, or violated a stop condition. The application already records many placement and lifecycle facts; do not manually recopy their counts.

## Sparse burden report

Once per week during the four use weeks, spend at most about two minutes on:

- one approximate **numeric total of planning/replanning minutes** for that week, compared only with the recorded prospective baseline; no stopwatch precision is needed, and an optional range or confidence/context note may accompany the number, but only the number enters the predeclared calculation;
- any important forgotten intention, disruption recovery or Reduced Day/re-entry burden that ordinary app facts cannot establish (one short example if applicable, without sensitive task text in a shared issue);
- whether visible plan movement or clarification steps made the day harder to understand;
- trust and autonomy/control, each 1–5 using the exact baseline questions and anchors above, with an optional one-sentence reason;
- whether use was voluntary and whether the learnt Normal reservation felt useful or required repeated correction, only if encountered.

These are sparse self-reports, not instrumented timings or causal estimates. Missing numeric minute estimates remain missing; do not choose a midpoint or bound from an optional range after seeing results. Review factual events and plan provenance alongside them, reporting bounded counts with their known scope. No matched opportunity denominator exists for a general override/correction/Undo rate, so calculate no such rate or percentage. Do not publish private task content or raw behavioural history as trial telemetry.

## Pause conditions

Pause evidence collection, preserve a safe backup and log the incident if:

- canonical personal data are lost/corrupted, a saved task/rhythm/instance disappears after reload, or portable recovery cannot be trusted;
- a known hard external commitment or explicit protected boundary is silently violated;
- a stale accepted plan is shown as trustworthy after known failed repair, a Move/Protect choice is silently discarded/overridden, or Undo contradicts newer canonical authority;
- repeated schedule churn makes the day harder to understand, or a blocking narrow/mobile defect prevents an ordinary primary action;
- inferred/unknown evidence is misrepresented as user-authored fact, or Normal learning consumes Full, Stop, legacy-unknown or other ineligible evidence;
- unexpected upload, sync, external calendar write or other external mutation occurs;
- the app or evidence protocol itself imposes substantial interaction burden.

Stopping is product evidence, not user failure. Gate 8B cannot begin at all while Gate 8A8 is BLOCK. For this initial Perth-only scope, an environment with a DST transition is outside the accepted population until issue #146 is resolved and separately accepted.

## Concise issue log

| Field | Record |
| --- | --- |
| Local date/time and timezone; tested URL and exact Git SHA | |
| Device/browser/viewport; screen/context | |
| Action and expected behaviour | |
| Actual behaviour and whether canonical data changed | |
| Effect on planning burden; severity/stop condition | |
| Screenshot/reference if useful, without unnecessary private content | |
| Backup preserved? Issue link and disposition | |

Use the current Gate 8A8 acceptance record for Day 1 authority. The PR #104-era checklist, launch note and readiness report are historical structure only.
