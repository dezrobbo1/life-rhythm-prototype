# Gate 8A7B3 populated daily surface and contextual correction

Status: implementation prepared for one draft PR; unmerged; integrated human acceptance pending.
Date: 2026-10-05. Source/base: `add82b74082f3bf347191d6ce97de2816169f4eb` (PR #174).
Branch: `feat/gate8a7b3-today-plan-relief`. Exact published head is recorded in PR metadata/body; this report does not manufacture a self-referential commit SHA.

## Bounded implementation

Approved outcome: one useful current action, quiet Later/Changed, reachable correction and clearly distinguished relief. This follows PRODUCT.md and MVP_PLAN.md's B3 boundary, with the existing deterministic state owners.

- Today TaskCard separates a useful primary Start/Resume/Minimum/Stop action from secondary continuation, Pause, Start Boost, Park, Not today and Details. Authored Minimum text/minutes stay visible; achieving Minimum continues to count through continuation. Unsupported task placeholders are removed.
- Day Line remains first. Its private rows disclose existing Move, Protect/Unprotect and grounded Why handlers through a render slot supplied by the single PersonalPlanScreen owner. Embedded detailed lists omit copies of those correction rows. Fixed/external rows have no correction controls. Maintenance stays in Plan details; material conflict attention and feedback remain outside it.
- Move uses the existing shared Modal with labelled local date/start inputs, preserved-duration copy, Save/Cancel, visible conflict feedback, Escape/cancel focus return and focus on the refreshed logical row after successful correction. Existing coordinator authority, recovery generation and conflict fencing are unchanged.
- Relief varies its primary action and consequence copy by zero/one/multiple visible Today tasks. Narrow Today marks extras not today; Park extras parks them. Neither is scheduler Reduced Day. Restart shows the first task's authored Minimum/minutes as an explicit preview and performs no start/completion write. Busy actions are guarded. History export/typed-confirmation deletion remain under explicit disclosure with inputs kept mounted; unsupported restore/tomorrow/full-reset prototypes are absent.
- Scoped CSS retains content-sized stacked controls and wrapping at mobile width, including Today, contextual Move, Reduced Day and re-entry. No scheduler policy, schema, migration, navigation lifecycle, account/provider, or legacy runtime change.

Implementation sequence: regressions for action hierarchy, unsupported/disclosed Relief, contextual correction, conflict and focus return; minimal UI changes; focused verification; full tests/build/timezone controls; cloud browser; unmerged handoff and draft publication. No additional broad review was requested; parent supplies one fresh independent review.

## Automated evidence

Final source validation from `app`:

| Command | Result |
| --- | --- |
| `TZ=UTC npm test` | PASS — 111 files, 1,384 tests |
| `TZ=Australia/Perth npm test` | PASS — 111 files, 1,384 tests |
| `npm run build` | PASS — TypeScript and Vite; existing large-bundle advisory remains |
| Root `git diff --check` | PASS |

Failing regressions preceded hierarchy/disclosure/contextual correction implementation. A further regression demonstrated Move conflict feedback needed to be inside the modal and successful Move needed logical-row focus after placement identity changed. Obsolete Reset-heading/disabled-Minimum assertions were updated to the approved Relief/useful-action behavior. The existing lifecycle test now waits for Park to be enabled before clicking it; making Park reachable in idle state means presence alone no longer establishes action readiness. No safety assertion was removed.

The full runs include TodayScreen, TodayChangedPersistence, TodayReadRecovery, TodayBoundaryRecovery, MinimumAchievementPersistence, ReentryActionsPersistence, PlanDayLineScreen, PlanScreen, RenderedRecoveryAdditional, ResetScreen, Modal, calmSurfaceRegression, Gate6DailyLoopAcceptance, correction coordinator, Reduced Day, rhythm, settings and portable recovery coverage. Existing unchanged persistence/Now-Later-Changed, midnight/read-failure, stale/conflict/repair, rhythm correction and Undo matrices remain exercised rather than rewritten merely for styling.

Harness corrections: fixed local wall-clock time for the new integrated test so Perth's actual late evening does not remove today's future capacity; advance that test clock between successful repairs. A fully frozen browser Date caused timestamp-based scheduler event ID collisions during repeated repair. The final cloud browser uses a running clock anchored to 09:00 Perth. These were harness corrections; scheduler/event rules were not changed.

## Cloud browser evidence

Actual cloud Chromium `151.0.7922.173`, Playwright through the installed runtime (agent-browser CLI unavailable). Fresh isolated browser context, throwaway IndexedDB data, Australia/Perth, running local date/time anchored to 2026-10-05 09:00. Desktop 1280×900 and mobile viewport 390×844. This is a cloud browser, not the owner's physical mobile or operating-system keyboard.

Observed PASS: populated Today and factual Later; Capture save/reload; contextual task Move rejection in the modal and successful preserved-duration move; Protect/Unprotect/Why with maintenance closed; Escape return; Start/Minimum/continuation/Pause/Resume; Reduced Day preview/apply/return with genuine Changed; truthful Relief preview and history disclosure preserving an unsaved confirmation; mobile wrapping/no horizontal overflow; dated re-entry choices; configured rhythm edit and occurrence execution; seven weekdays/work/usable-day inputs; downloaded portable export and checked uploaded file. Portable restore was not applied in this browser run; destructive/stale recovery remains covered by isolated automated tests. No runtime page errors were recorded.

Screenshots and replay/report artifacts are delivered separately in `gate8a7b3-browser-evidence.zip`, not committed as generated output or personal data:

- `today-desktop.png`, `today-minimum-desktop.png`, `today-mobile.png`;
- `plan-context-desktop.png`, `plan-move-conflict-desktop.png`, `plan-move-mobile.png`;
- `reduced-day-preview-desktop.png`, `today-changed-reduced-desktop.png`, `reentry-mobile.png`;
- `relief-desktop.png`, `relief-mobile.png`;
- `rhythm-config-mobile.png`, `settings-planning-mobile.png`, `portable-check-mobile.png`;
- `browser-report.json` and replay script. Throwaway exported profile JSON is excluded from the delivered archive.

Browser screenshots come from the final source tree on the local Vite server. No immutable hosted preview was available at report preparation. A later preview must identify the exact PR head before owner acceptance. Source/build tests and cloud screenshots cannot establish hosted/device readiness.

## Exact-build human acceptance record

**MANUAL ACTION REQUIRED** under [HUMAN_GATES](../../docs/HUMAN_GATES.md): perform the rows below on the exact draft-PR head and attributable preview/build. Record SHA, preview URL/build ID, device, OS, browser/version, portrait dimensions, physical keyboard type and date/time/timezone. Record PASS/FAIL, observed outcome and screenshot/video for each row. Rows remain PENDING; prior B2 acceptance does not establish B3 integrated acceptance.

| Row | Required real-device/owner evidence | Status |
| --- | --- | --- |
| Mobile Capture | Portrait with OS keyboard; title/action/minutes, optional details, reachable Save/Cancel; save and reload | PENDING |
| Mobile Task edit | Populated Now; Details/Edit task, long text and inputs; keyboard open; reachable save/cancel | PENDING |
| Populated Today | Idle/in-progress/paused/Minimum/continuation/terminal; one useful action; truthful later facts and quiet Changed; empty/no debt | PENDING |
| Contextual correction | Task and rhythm Day Line disclosures; Move local date/start, duration, conflict, save/cancel; Protect/Unprotect/Why; no external write | PENDING |
| Repair and Undo | Genuine disruption/Changed; material repair attention; eligible Undo/reload; no unsafe persistent-correction Undo | PENDING |
| Reduced Day and re-entry | Preview before apply; Return to normal/eligible Undo; explicit no-catch-up re-entry choices | PENDING |
| Relief | Zero/one/multiple tasks; clear Narrow/Park consequences; preview-only restart; history disclosure and safeguards | PENDING |
| Rhythm | Configure/enable, generated occurrence and Today execution, Minimum counts and linked identity after reload | PENDING |
| Life shape/calendar snapshot | All seven weekdays; work and usable-day inputs, Save; clearly static read-only snapshot controls | PENDING |
| Portable recovery | Export/check; throwaway recovery only after explicit replacement confirmation; reload and isolation | PENDING |
| Desktop/keyboard | Tab and Enter/Space activation, visible focus, Escape, Save/Cancel return and disclosure preserving inputs | PENDING |
| Subjective burden | Owner judgment: fewer decisions, calm surface, tolerable wrapping/scrolling, useful corrections and relief | PENDING |

**PRODUCT OWNER DECISION REQUIRED** for the final subjective acceptance decision. Independent engineering review also remains pending. Do not close #168/#160, declare B3 acceptance complete or 8A8 PASS, begin 8B or merge in this cloud task. Later sequence remains 8A7C account continuity, 8A7D live read-only calendar, then integrated 8A8. #146 remains separate for internal DST-transition populations.
