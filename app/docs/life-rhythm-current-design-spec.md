# Life Rhythm Current Design Spec
Status: Living design specification
Scope: Product direction, current implementation state, design boundaries, and near-term roadmap
Last consolidated after: PR #49 — Read-only Day Shape preview
## 1. Product Identity
Life Rhythm is a non-clinical self-management app for adults with ADHD traits or an ADHD diagnosis.
It supports habits, rhythms, task initiation, re-entry after missed or disrupted days, protected time, and
daily life maintenance. The app is designed for people who often benefit from rhythm and structure but
may resist rigid scheduling, external pressure, shame-based productivity systems, or tools that turn daily
life into a timetable.
Life Rhythm is not a medical product. It must not diagnose, treat, monitor clinical compliance, claim medical
outcomes, replace therapy, or present itself as clinical care.
Life Rhythm must avoid:
• diagnosis or treatment language
• medical outcome claims
• therapy or coach-authority framing
• compliance monitoring
• shame or failure language
• scores
• streak pressure
• public accountability
• coercive reminders
• productivity punishment
• dopamine-hack language
• gamified pressure
• “you are behind” framing
The product should remain calm, practical, and user-led.
## 2. Core Product Principle
The central product principle is:
Power underneath. Calm on the surface.
Life Rhythm can have strong modelling, validation, persistence, backup, and planning logic underneath, but
the user-facing experience should stay light, forgiving, and non-coercive.

Supporting principles:
• Rhythm without capture.
• Structure without ownership of the whole day.
• Re-entry without punishment.
• Planning without life becoming a timetable.
• Not every unscheduled gap is available.
• Minimum done counts.
• Parked is safe, not failed.
• Not today is allowed.
• Blank time is not automatically task space.
The product should help users protect their life from overfilling, not simply find more gaps to consume.
## 3. Current Implementation State After PR #49
The app now has a real local-first foundation. It is no longer only a static prototype shell.
Implemented:
• settings persistence
• theme persistence
• Start Boost safety persistence
• Life Shape persistence
• settings backup export
• settings backup validation preview
• custom Library rhythm persistence
• Library rhythm backup export
• Library rhythm backup validation preview
• active Today task persistence
• Add one-off Today tasks
• Add Library rhythm to Today
• active task status persistence
• Start / Pause / Resume / Minimum done
• Stop here / Park / Not today
• active task backup export
• active task backup validation preview
• active task deadline/time-edge schema fields
• Life Shape protected/recovery/loose/household/family/open-capacity blocks
• Setup “Time to leave alone” controls
• read-only Day Shape preview in Plan
Not implemented yet:
• deadline/time-edge UI in Add one-off
• missed-task detection
• missed/re-entry behaviour

• soft scheduler
• user-confirmed task placement
• calendar load
• iOS/native calendar integration
• auth/login
• cloud sync
• AI pattern suggestions
• full design-board visual parity
• external tester readiness
Current practical status:
• A basic personal manual trial is close, but not yet representative of the intended product.
• A meaningful personal trial should wait until time-edge UI, missed/re-entry behaviour, and a soft
scheduling loop exist.
• External tester readiness should wait until the daily loop, onboarding, backup confidence, privacy/
auth boundary, and visual polish are stronger.
## 4. PR Milestone Snapshot
Recent key milestones:
• PR #29: settings persistence with validation
• PR #30: settings backup export
• PR #31: settings backup import validation preview
• PR #32: settings backup/recovery UX polish
• PR #33: Library rhythm persistence contract
• PR #34: Library rhythm backup validation scaffolding
• PR #35: user-created Library rhythm persistence
• PR #36: create rhythm save failure handling
• PR #37: Library rhythm export backup action
• PR #38: Library rhythm import validation preview
• PR #39: Today active task persistence contract
• PR #40: Add to Today and one-off active task persistence
• PR #41: Today completion and re-entry states
• PR #42: active task backup validation scaffolding
• PR #43: active task export backup action
• PR #44: active task backup import validation preview
• PR #45: soft scheduling and protected time contract
• PR #46: deadline and re-entry contract
• PR #47: active task deadline schema support
• PR #48: Life Shape protected time schema and Setup UI
• PR #49: read-only Day Shape preview
The current app foundation is deliberately staged: schema and persistence first, then read-only previews,
then controlled user-facing behaviour, then scheduler.

## 5. Data and Write Boundaries
Current approved write surfaces:
1. Settings only
2. Custom Library rhythms only
3. Active Today tasks only
4. Active task status updates only
Current settings writes include:
• theme
• Start Boost safety settings
• Life Shape
• Life Shape time blocks
Current Library writes include:
• user-created custom rhythm templates only
Current Today writes include:
• Add one-off Today tasks
• Add Library rhythm to Today
• status updates for active tasks
Current read-only or non-write surfaces:
• settings backup validation preview
• Library rhythm backup validation preview
• active task backup validation preview
• Day Shape preview
• scheduler contracts
• deadline/re-entry contracts
• protected-time contract
Explicitly not implemented:
• no scheduler writes
• no calendar writes
• no AI writes
• no backend
• no sync
• no analytics
• no account system yet
• no import/restore execution yet
• no task history or completion logs yet
• no notification system

• no calendar integration
• no migration execution exposed to users
Import/check flows are validation previews only. They must not silently restore or mutate user data.
## 6. Life Shape and Protected Time Model
Life Shape describes the user’s real day shape. It should not be treated as a productivity timetable.
Life Shape currently includes:
• usual work hours
• meal anchors
• sleep/wake anchors
• fixed commitments
• commute/travel
• transition buffers
• low-capacity preference
• protected time blocks
• recovery time blocks
• loose time blocks
• household flow blocks
• family time blocks
• open capacity blocks
Time block meanings:
protectedTime
Time the user wants left alone by default.
Default scheduler use: unavailable .
Examples:
• quiet morning
• evening wind-down
• personal decompression
• private time
• reading or gaming time
• time the user does not want the app to consume
recoveryTime
Low-demand rest, decompression, or reset time.
Default scheduler use: unavailable .

Examples:
• after work decompression
• after school run
• after meetings
• after social load
• low-capacity evening
looseTime
Unstructured time that can stay unstructured.
Default scheduler use: askFirst .
Examples:
• pottering around
• watching TV
• slow weekend time
• general downtime
• flexible evening
Loose time is not empty task space.
householdFlow
Home-life movement and responsibilities that may not be precisely scheduled.
Default scheduler use: askFirst .
Examples:
• cooking
• tidying around
• kids moving through routines
• laundry happening in the background
• small home jobs
familyTime
Family, partner, parenting, care, or social time.
Default scheduler use: unavailable .
Examples:
• playing with kids

• partner time
• dinner
• bedtime routine
• family afternoon
openCapacity
Time the user has explicitly marked as possible planning space.
Default scheduler use: available .
Open capacity is the only block type that should be treated as potentially available by default, and even then
future scheduler output must remain suggestive and explainable.
Core rule:
Blank time is not automatically available.
The future scheduler must not infer availability from empty space.
## 7. Today Model
Today is the main action surface. It should show one useful next action and avoid overwhelming the user.
Today supports:
• one useful next action
• one-off today-only tasks
• Add to Today from Library
• minimum / normal / full versions
• Start
• Pause
• Resume
• Minimum done
• Stop here
• Park
• Not today
Active task statuses include:
• active
• inProgress
• paused
• minimumDone
• done
• parked

• skipped
• notToday
Future task statuses may include:
• missed
• archived
Today rules:
• Minimum done counts.
• A task can be parked without shame.
• Not today is allowed.
• The app should not create a catch-up pile.
• One visible action is usually better than many simultaneous demands.
• When one task leaves Today, another task can appear only if it already exists and is safe to show.
• Task state should be practical, not moral.
One-off tasks are currently the safest place to introduce deadline/time-edge controls because they are
explicitly user-created and today-scoped.
## 8. Deadline and Time-Edge Model
Deadline and time-edge schema support now exists for active tasks, but full UI behaviour is not yet
implemented.
Supported future fields:
• timeConstraint
• dueAt
• fixedAt
• expiresAfter
• latestUsefulStartAt
• notUsefulAfter
• minimumStillUsefulAfterDeadline
• missedPolicy
Supported time constraints:
• flexible
• dueBy
• fixedAt
• expiresAfter
Supported missed policies:
• ask
• park

• notToday
• minimumOnly
• followUpPrompt
• hideUntilReview
• archiveIfExpired
Deadline principles:
• Deadlines are usefulness windows, not pressure.
• A time edge describes when an action is useful.
• A task can become less useful without becoming a failure.
• Time-edge data must not schedule anything by itself.
• The minimum version should remain valid when it still helps.
• After a useful window passes, the user should get calm choices.
Avoid wording such as:
• overdue
• late
• failed
• urgent
• behind
Use wording such as:
• Useful before
• Tied to
• Useful until
• Minimum still helps
• No schedule created
• Move, park, or mark not today
• No longer needed is allowed
Next expected step: add time-edge controls to Add one-off Today tasks.
## 9. Re-Entry Model
Re-entry is core to Life Rhythm.
The app should assume that disruption is normal. Missed, skipped, parked, or not-today tasks should be
safely held, not treated as evidence of failure.
Future re-entry should offer choices such as:
• do the minimum version
• move later
• park safely
• mark not today

• mark no longer needed
• choose another task
• review later
Re-entry rules:
• Missed tasks must not auto-stack into Today.
• Skipped tasks must not be shown as failure.
• Parked tasks should remain safe and findable.
• Minimum done counts.
• No re-entry flow should imply penalty, judgement, or duty-to-perform.
• Re-entry should happen at sensible moments, not every time the app opens.
The product should not ask the user to “catch up”. It should help them re-enter.
## 10. Scheduler Direction
Scheduler is future work.
The future scheduler must be soft, explainable, user-led, and respectful of protected/loose/open capacity.
The scheduler may eventually:
• suggest broad placement windows
• suggest shrinking to the minimum version
• suggest moving something later
• suggest parking a task
• suggest choosing not today
• explain why a placement might fit
• respect Life Shape blocks
• respect time edges
• surface schedule options for user confirmation
The scheduler must not:
• silently fill the day
• treat blank time as available
• schedule into protected time by default
• schedule into loose time without asking
• create catch-up piles
• punish skipped or missed tasks
• create pressure language
• score the user
• write calendar events
• auto-create active tasks from enabled rhythms
• expose internal debug metadata in the daily UI
Scheduler output must remain separate from persisted task state until the user explicitly accepts or edits it.

The correct model is:
The scheduler suggests.
The user decides.
not:
The scheduler owns the day.
## 11. AI Direction
AI is future work.
AI should be background support, not the app’s core system. The app must remain useful without AI.
Future AI may suggest:
• hidden edges
• rhythm packs
• pattern observations
• schedule preferences
• re-entry options
• smaller minimum versions
• possible protected-time rules
• wording for user review
AI must not:
• diagnose
• treat
• score
• enforce
• shame
• act as therapist
• act as coach authority
• schedule tasks directly
• decide what the user must do
• write task state
• write calendar events
• silently alter settings
• execute imports or restores
AI suggestions must remain pending until the user accepts, edits, or dismisses them.
Best future model:

Life Rhythm is the system.
AI is a proposal layer.
Not:
AI is the system.
Life Rhythm is just the interface.
High-value AI use cases:
• “Things that seem to work for you”
• hidden edge suggestions for user-created tasks and rhythms
• rhythm pack suggestions for user goals
• pattern observations based on accepted local history
• re-entry option suggestions
AI should not be introduced until the core daily loop and scheduler boundaries are stable.
## 12. Trial Account and Login Direction
Auth/login is future work and is useful for multi-person trials.
Important distinction:
Login is not the same as cloud sync.
A login system identifies a user. It does not automatically mean Life Rhythm data should be uploaded.
Future account direction:
• invite-only trial access preferred
• no public signup by default
• identity/access layer first
• local-first data remains local unless a later sync contract explicitly approves upload
• user-scoped local data namespace
• no admin reading personal task data by default
• no analytics by default
• backup/export remains user-controlled
• account deletion/export requirements should be defined before external trials
• cloud sync requires a separate contract and privacy/security review
Core rule:
Login may identify the user. Login must not silently upload Life Rhythm data.

Likely future provider direction:
• Clerk is likely the first auth-shell option for trial login.
• Supabase should be considered only if/when cloud data and Postgres-backed sync are approved.
• Firebase/Auth0/other providers remain alternatives but should not be added without an auth
boundary contract.
Recommended auth sequence:
1. Auth and trial account boundary contract
2. Invite-only login shell
3. User-scoped local data namespace
4. Account-aware backup/export wording
5. Cloud sync only after a separate sync contract
Auth should not be added casually. It changes privacy expectations.
## 13. Trial Readiness
There are three trial levels.
Basic personal manual trial
Close, but not yet representative.
The app can already support local settings, Library, Today tasks, task states, backups, protected time blocks,
and Day Shape preview. However, it does not yet have the intended time-edge UI, missed-task behaviour, or
soft scheduler loop.
Meaningful personal trial
Likely after:
• one-off time-edge controls
• missed/re-entry behaviour
• read-only soft scheduler suggestions
• user-confirmed soft placement
• trial hardening
• basic mobile pass
This is the point where the app can be used for a week and produce useful learning.
External tester trial
Should wait until:
• the daily loop is stable

• onboarding is clearer
• backup/export is trustworthy
• auth/privacy boundary exists
• visual polish is closer to the design boards
• at least one personal trial has been completed
• language has had a non-clinical safety pass
The app should not be given to external ADHD testers while major daily-loop assumptions are still unstable.
## 14. Design-Board Parity
The app currently has stronger foundations than visual polish.
It does not yet fully match the design boards. That is expected because the build sequence deliberately
prioritised persistence, schema boundaries, backup safety, and behaviour before visual parity.
Do not chase full design-board parity before the daily loop is stable. Otherwise the team may polish screens
that still need structural changes.
Future design-board alignment sequence:
1. App shell / navigation / spacing / typography pass
2. Today screen alignment
3. Plan and Day Shape visual alignment
4. Library screen alignment
5. Setup / backup / recovery alignment
6. Mobile and tap-target polish
7. Calm empty-state and error-state copy pass
Design-board work should happen after:
• time-edge controls
• missed/re-entry behaviour
• soft scheduler loop
• trial hardening
The visual direction should preserve:
• calm surfaces
• low visual pressure
• no competitive/gamified status
• clear hierarchy
• easy tap targets
• readable mobile layout
• useful defaults
• soft language

## 15. Independent Preview Boundary
The independent/local preview zip is a prototype lab reference only.
It should not be merged as source.
Use it for:
• UX inspiration
• flow ideas
• visual richness
• possible scheduler concepts
• design-board comparison
Do not use it for:
• production merge base
• persistence model
• backup/import behaviour
• scheduler authority
• trusted schema source
The main GitHub repo remains the trusted implementation path.
## 16. Current Near-Term Roadmap
Recommended next sequence:
1. Update current design spec
2. Auth/trial account boundary contract
3. One-off task time-edge controls
4. Missed/re-entry behaviour
5. Read-only soft scheduler suggestions
6. User-confirmed soft placement
7. Trial hardening
8. Visual design-board alignment
9. Personal trial
10. External tester preparation
Alternative sequence if trial login is deprioritised:
1. One-off task time-edge controls
2. Missed/re-entry behaviour
3. Read-only soft scheduler suggestions
4. User-confirmed soft placement
5. Auth/trial account boundary contract
6. Trial hardening

7. Visual alignment
Decision needed: whether auth boundary comes before time-edge UI.
## 17. Open Decisions
Open product and implementation decisions:
• Should auth boundary be added before one-off time-edge UI?
• Should Clerk be the first auth-shell provider?
• Should cloud sync be deferred until after personal trial?
• How much design-board polish is needed before personal trial?
• Should AI wait until after scheduler/calendar basics?
• When should ADHD professional review be requested?
• Should external testers be invite-only from the start?
• Should calendar load begin with manual blocks only, read-only .ics , or native integration later?
• When should import/restore execution be enabled, if ever?
• Should task history/completion logs exist before AI pattern observations?
## 18. Guardrails for Future PRs
Every future PR should state which boundary it touches.
Allowed current/future categories:
• docs only
• settings write
• Library rhythm write
• active task write
• active task status write
• backup export
• backup validation preview
• read-only view model
• read-only scheduler suggestion
• user-confirmed scheduler write
• auth identity only
• cloud sync
• calendar read-only
• calendar write
• AI proposal only
• AI accepted-write path
High-risk categories require explicit contract first:
• auth
• backend
• sync

• calendar integration
• scheduler writes
• AI writes
• import/restore execution
• migrations
• task history/completion logs
• analytics
• notifications
Default rule:
If a PR changes where user data goes, what writes happen, or who can see the data, it needs a
contract first.
## 19. Current Product Definition
Life Rhythm is currently best understood as:
A local-first ADHD-optimised rhythm and re-entry app
with calm task initiation,
protected time,
backup-safe persistence,
and future soft scheduling.
It is not:
a medical app
a compliance app
a gamified productivity app
a calendar replacement
an AI coach
a public accountability system
a full scheduler yet
The target user experience is:
I can open the app,
see one useful next action,
protect parts of my life,
do the minimum if that is what fits,
park things without shame,
and re-enter without a catch-up pile.
That is the design centre.
