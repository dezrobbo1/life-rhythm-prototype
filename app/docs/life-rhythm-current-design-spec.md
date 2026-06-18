# Life Rhythm Current Design Spec
Status: Living design specification
Scope: Product direction, current implementation state, design boundaries, and near-term roadmap
Last consolidated after: PR #64 - Soft placement backup export and validation preview
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
## 3. Current Implementation State After PR #64
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
• optional Time edge section in Add one-off
• one-off dueBy/fixedAt/expiresAfter capture
• calm Today card time-edge copy
• Life Shape protected/recovery/loose/household/family/open-capacity blocks
• Setup “Time to leave alone” controls
• read-only Day Shape preview in Plan
• Re-entry review section in Today
• read-only time-edge re-entry preview
• user-confirmed Park safely and Mark not today from re-entry review
• Try the minimum helper copy only
• read-only Plan soft suggestions
• openCapacity-only Add soft placement
• saved soft placements in Plan
• Remove placement marks a placement removed without deleting the task
• soft placement schema and repository
• soft placement backup export
• soft placement backup validation preview
• removed placements included in soft placement backups as explicit local state
• trial account/auth boundary contract
• opt-in Clerk auth shell
• signed-out trial access shell
• signed-in account bar
• user-scoped hashed local database namespaces
• legacy local data handoff notice
Not implemented yet:
• missed-task detection
• missed status persistence
• askFirst placement
• move/edit soft placement
• automatic scheduling
• scheduler-owned placement
• calendar load
• iOS/native calendar integration
• cloud sync
• AI pattern suggestions
• import/restore execution
• notifications
• full design-board visual parity
• external tester readiness
Current practical status:
• A basic personal manual trial can now exercise local settings, Library rhythms, active Today tasks,
one-off time edges, protected time, Day Shape preview, Re-entry review, read-only soft suggestions,
user-confirmed open-capacity soft placements, soft placement backups, and opt-in signed-in local profiles.
• A meaningful personal trial is closer, but should still wait for trial hardening, smoke QA, and a basic
review of the soft-placement loop on mobile.
• External tester readiness should wait until onboarding, backup confidence, Clerk
invite-only/public-signup configuration, and visual polish are stronger.
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
• PR #50: one-off task time edge controls
• PR #51: current design spec added
• PR #52: trial account/auth boundary contract
• PR #53: invite-only Clerk auth shell
• PR #54: auth-aware local data namespaces
• PR #55: auth local data handoff notice
• PR #56: design spec updated through auth handoff
• PR #57: read-only time-edge re-entry preview
• PR #58: user-confirmed re-entry actions
• PR #59: read-only soft schedule suggestions
• PR #60: user-confirmed soft placement contract
• PR #61: soft placement schema and repository
• PR #62: user-confirmed soft placement from open-capacity suggestions
• PR #63: saved soft placements shown in Plan with safe removal
• PR #64: soft placement backup export and read-only validation preview
The current app foundation is deliberately staged: schema and persistence first, then read-only previews,
then controlled user-facing behaviour, then scheduler.

## 5. Data and Write Boundaries
Current approved write surfaces:
1. Settings only
2. Custom Library rhythms only
3. Active Today tasks only
4. Active task status updates only
5. User-confirmed soft placements only
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
Current soft placement writes include:
• openCapacity-only user-confirmed soft placements
• removal by marking placement status removed
• no task deletion
• no active task status change
Current auth/local-profile surfaces:
• opt-in Clerk identity shell
• signed-out trial access screen
• signed-in account bar
• hashed user-scoped local database namespaces when auth is enabled
• legacy local setup handoff notice when existing local data is detected
Current read-only or non-write surfaces:
• settings backup validation preview
• Library rhythm backup validation preview
• active task backup validation preview
• soft placement backup validation preview
• Day Shape preview
• Re-entry review preview
• read-only soft suggestions
• scheduler contracts
• deadline/re-entry contracts
• protected-time contract
Explicitly not implemented:
• no scheduler writes
• no calendar writes
• no AI writes
• no backend
• no sync
• no cloud data upload
• no analytics
• no public signup in the app UI
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
• optional Time edge section in Add one-off
• one-off flexible/dueBy/fixedAt/expiresAfter capture
• calm time-edge display copy on Today cards
• Re-entry review for tasks whose useful windows may need calm review
• user-confirmed Park safely from Re-entry review
• user-confirmed Mark not today from Re-entry review
• Try the minimum helper copy only
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
• Time-edge data describes usefulness; it must not schedule anything by itself.
• Re-entry review does not mark tasks missed by itself.
• Re-entry actions are user-confirmed only.
One-off tasks are currently the safest place for deadline/time-edge controls because they are explicitly
user-created and today-scoped.
## 8. Deadline and Time-Edge Model
Deadline and time-edge schema support now exists for active tasks, and Add one-off now exposes optional
time-edge controls. Today also has a read-only time-edge re-entry preview with user-confirmed Park safely
and Mark not today actions. Full missed-task detection and missed status persistence are not implemented yet.
Supported fields:
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
Current Add one-off UI supports:
• Flexible
• Due by
• Fixed at
• Expires after
• optional latest useful start
• optional not useful after
• minimum still useful after deadline
• missed policy selection for future re-entry behaviour
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
Next expected step: trial hardening and smoke QA before expanding re-entry further.
## 9. Re-Entry Model
Re-entry is core to Life Rhythm.
The app should assume that disruption is normal. Missed, skipped, parked, or not-today tasks should be
safely held, not treated as evidence of failure.
Current implemented re-entry behaviour:
• Today can show a Re-entry review section for active tasks whose time-edge data suggests their useful
window may need review.
• Re-entry review copy says nothing has moved and there is no catch-up pile.
• Park safely and Mark not today are user-confirmed actions.
• Try the minimum is helper copy only; it does not create a new state.
• These actions use existing active task status updates.
• No automatic missed-task persistence exists yet.
Future re-entry may offer more choices such as:
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
• Nothing moves unless the user chooses.
• No re-entry flow should imply penalty, judgement, or duty-to-perform.
• Re-entry should happen at sensible moments, not every time the app opens.
The product should not ask the user to “catch up”. It should help them re-enter.
## 10. Scheduler and Soft Placement Direction
Scheduler-owned placement is future work.
The current app has read-only Plan soft suggestions and user-confirmed open-capacity soft placements, but it
does not have an automatic scheduler.
Current implemented soft-placement-adjacent behaviour:
• Plan can show read-only soft suggestions.
• Soft suggestions are not placements.
• Blank time is not treated as available.
• Suggestions only use openCapacity blocks as addable placement targets.
• askFirst blocks may appear as possibilities, but are not accepted yet.
• protectedTime, recoveryTime, and familyTime remain unavailable by default.
• Users can add a soft placement only from an openCapacity suggestion.
• Soft placement is local only.
• Soft placement is not a calendar event.
• Saved soft placements appear in Plan for the selected day.
• Remove placement marks the placement removed without deleting the task.
• Removed placements are included in backup as explicit local state.
• Soft placement backup export exists.
• Soft placement backup checking is read-only.
• No soft placement restore exists yet.
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
Soft placement rules:
• Placement is user-confirmed only.
• A placement is not a deadline.
• A placement is not compliance tracking.
• A placement must be removable without deleting the task.
• A placement must not imply failure if it is removed or changed.
• There is no catch-up pile.
• There is no scoring, streak, or compliance model.

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
Auth/login shell support now exists for trial access, behind opt-in environment configuration.
Important distinction:
Login is not the same as cloud sync.
A login system identifies a user. It does not automatically mean Life Rhythm data should be uploaded.
Current account direction:
• Clerk is the first auth-shell provider
• auth activates only when enabled and configured
• signed-out users see a calm trial access shell
• signed-in users see a minimal account bar
• signed-in users use hashed user-scoped local database namespaces
• legacy local setup handoff notice appears when existing legacy local data is detected
• invite-only trial access remains the intended operational model
• no public signup by default
• identity/access layer first, not cloud sync
• local-first data remains local unless a later sync contract explicitly approves upload
• no admin reading personal task data by default
• no analytics by default
• backup/export remains user-controlled
• sign-out does not delete local data
• sign-in does not silently merge existing local data
• pre-auth/local legacy data remains untouched
• account deletion/export requirements should be defined before broader external trials
• cloud sync requires a separate contract and privacy/security review
Core rule:
Login may identify the user. Login must not silently upload Life Rhythm data.

Provider direction:
• Clerk is the current first auth-shell option for trial login.
• Clerk dashboard invite-only/public-signup configuration still needs operational verification before
external testers.
• Supabase should be considered only if/when cloud data and Postgres-backed sync are approved.
• Firebase/Auth0/other providers remain alternatives but should not be added without a separate review.
Completed auth sequence:
1. Auth and trial account boundary contract
2. Invite-only login shell
3. User-scoped local data namespace
4. Legacy local setup handoff notice
Remaining auth-adjacent work:
1. Operational Clerk invite-only/public-signup verification
2. Account-aware backup/export wording
3. Cloud sync only after a separate sync contract, if needed at all
Auth should not be added casually. It changes privacy expectations.
## 13. Trial Readiness
There are three trial levels.
Basic personal manual trial
Closer, and now representative enough for focused smoke QA.
The app can already support local settings, Library, Today tasks, task states, backups, protected time blocks,
Day Shape preview, Add one-off time edges, Re-entry review, read-only soft suggestions, user-confirmed
open-capacity soft placements, saved soft placements, soft placement backups, and opt-in local signed-in
profiles. However, it does not yet have missed-task detection, askFirst placement, move/edit placement,
calendar integration, AI suggestions, import/restore execution, or external tester readiness.
Meaningful personal trial
Likely after:
• trial hardening / smoke QA
• basic mobile pass
• review of one-week backup/export confidence
• optional move/edit soft placement decision
• Clerk invite-only/public-signup operational verification if auth is enabled
This is the point where the app can be used for a week and produce useful learning.
External tester trial
Should wait until:
• the daily loop is stable

• onboarding is clearer
• backup/export is trustworthy
• auth/privacy boundary exists and Clerk invite-only/public-signup settings are operationally verified
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
• trial hardening
• the current soft-placement loop has been reviewed on mobile
• askFirst and move/edit placement boundaries are decided
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
1. Update design spec through soft placement backup
2. Trial hardening / smoke QA
3. Optional move/edit soft placement contract or implementation
4. Ask-first placement contract before any askFirst acceptance
5. Personal trial readiness pass
6. Visual design-board alignment
7. Clerk invite-only/public-signup operational verification
8. External tester preparation
9. Cloud sync contract only if later trial learning shows a clear need
Cloud sync remains intentionally unimplemented.
## 17. Open Decisions
Open product and implementation decisions:
• What operational Clerk invite-only settings are required before external testers?
• Should cloud sync be deferred until after personal trial?
• How much design-board polish is needed before personal trial?
• Should AI wait until after scheduler/calendar basics?
• When should ADHD professional review be requested?
• Should external testers be invite-only from the start?
• Should move/edit soft placement be contracted or implemented next?
• What exact confirmation should be required before accepting askFirst placement?
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
• user-confirmed soft placement write
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
• askFirst placement
• move/edit placement
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
opt-in signed-in local profiles,
user-confirmed local soft placements,
and future soft scheduling.
It is not:
a medical app
a compliance app
a gamified productivity app
a calendar replacement
an AI coach
a cloud-synced app yet
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
