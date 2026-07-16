# Life Rhythm Object Grammar Spec

Status: Current object-grammar contract; implementation is partial
Scope: Visual and interaction grammar for Life Rhythm product objects
Source basis: Applied ADHD UX/UI research, current design spec, soft scheduling loop contract, current boards, and source packets

Current implementation note: the current `/app` object model includes Today actions, Pool-held items, day-shape bands, soft suggestions and user-confirmed placements. The full grammar is a refinement boundary, not a claim that every visual rule is already implemented. Runtime status is governed by `app/docs/life-rhythm-current-design-spec.md`.

## 1. Purpose

Life Rhythm should be designed from product objects, not generic components.

This spec defines how the core objects should feel, appear, and behave so implementation does not fall back into card soup, decorative chips, generic badges, or dashboard panels.

## 2. Object grammar principles

Every object should answer:

- What is this?
- Why is it here?
- Is it asking for action now?
- What is the smallest useful next move?
- Where will it go if I do not act now?

Objects must be:

- readable
- recoverable
- plain-language
- low-pressure
- visually distinct by role
- not dependent on colour alone

Objects must not imply:

- failure
- debt
- compliance
- productivity score
- streak continuation
- public accountability
- clinical treatment

## 3. Hierarchy levels

Use these hierarchy levels:

### Level 1 — Dominant active object

Used for the current Today next action only.

- one per screen maximum
- may use a contained primary surface
- strongest title hierarchy
- one primary action
- quiet secondary exits

### Level 2 — Anchored planning object

Used for confirmed soft placements and important day-shape bands.

- visible but not dominant
- anchored to context
- clear remove/move path

### Level 3 — Held object

Used for captured, parked, not-today, and deferred items.

- ledger row
- grouped inside tray
- low pressure
- easy to re-enter

### Level 4 — Quiet reference object

Used for no-longer-needed, archived, backup receipts, and local-first notices.

- muted row or receipt
- not visually competitive
- findable when needed

## 4. Today next action

Purpose: show one useful next action.

Emotional meaning: present and workable.

Surface: one primary contained object.

Visual weight: highest on Today.

Required visible content:

- task title
- minimum version
- primary action
- quiet exits
- relevant useful-window note, only if it matters

Interaction behaviour:

- Start / pause / resume stay primary when relevant
- Minimum done should feel like release, not reward
- Park and Not today should be visible but calm

Must not look like:

- one card among many equal cards
- productivity score panel
- habit streak object
- calendar appointment
- warning alert

## 5. Captured task

Purpose: record something for later without making it a Today demand.

Emotional meaning: safely held.

Surface: ledger row in Pool.

Visual weight: low.

Required visible content:

- title
- area or context
- minimum version
- optional useful-window note

Interaction behaviour:

- can open details
- can be marked no longer needed
- later may be suggested for a soft window

Must not look like:

- backlog debt
- urgent task
- inbox-zero item
- required action

## 6. Task Pool item

Purpose: hold task-like objects outside Today.

Emotional meaning: stored, findable, recoverable.

Surface: grouped ledger row inside Holding Tray.

Visual weight: low to medium.

Treatment:

- grouped by state
- no red counts
- no pending total
- no overdue language
- no pressure badges

Must not look like:

- CRM queue
- kanban backlog
- email inbox
- task debt list

## 7. Parked item

Purpose: hold something intentionally out of the current day.

Emotional meaning: set aside safely.

Surface: ledger row.

Visual weight: low.

Treatment:

- pause/hold mark may be used sparingly
- copy should indicate safe holding
- bring-back action should be available through details or row action

Must not look like:

- failed item
- hidden punishment
- abandoned task

## 8. Not today item

Purpose: remove from Today without moral judgement.

Emotional meaning: permission.

Surface: ledger row in Not today group.

Visual weight: low.

Treatment:

- quiet label: Not today
- helper: kept out of Today
- no red or warning styling

Must not look like:

- skipped because failed
- overdue item
- rejected obligation

## 9. Deferred / bring-back-later item

Purpose: hold until a later review moment or soft window.

Emotional meaning: recoverable later.

Surface: ledger row with future cue.

Visual weight: low.

Treatment:

- show future cue only when useful
- avoid countdown or alarm styling
- bring-back action should be clear when available

Must not look like:

- snoozed notification stack
- reminder debt
- hidden deadline alarm

## 10. No longer needed item

Purpose: retire an item that is no longer useful.

Emotional meaning: release.

Surface: collapsed quiet reference row.

Visual weight: very low.

Treatment:

- muted archived styling
- no destructive red unless deleting is explicitly introduced later
- no strikethrough drama by default

Must not look like:

- failure
- deletion threat
- discarded work

## 11. Repeating rhythm

Purpose: reusable source pattern.

Emotional meaning: a rhythm recipe or shelf item.

Surface: Library shelf/index row.

Visual weight: medium in Library.

Required visible content:

- rhythm name
- purpose
- minimum version
- fit/duration metadata

Must not look like:

- streak habit
- compliance routine
- performance programme
- gamified challenge

## 12. Rhythm instance

Purpose: one occurrence of a repeating rhythm.

Emotional meaning: this instance only, safely connected to its source.

Surface: row or light strip.

Visual weight: medium when active or suggested.

Treatment:

- show source rhythm softly
- show instance-specific useful window if relevant
- do not duplicate the source rhythm visually as a new permanent task

Must not look like:

- independent duplicate debt
- compliance occurrence
- missed streak event

## 13. Soft suggestion

Purpose: show that something could fit in an open capacity window.

Emotional meaning: possibility.

Surface: light note or row attached to a day band.

Visual weight: low.

Treatment:

- use language like “Could fit here”
- appear lighter than confirmed placement
- include accept/edit/dismiss path

Must not look like:

- scheduled appointment
- command
- AI decision
- calendar event

## 14. Soft placement

Purpose: user-confirmed tentative placement.

Emotional meaning: held here for now.

Surface: anchored strip inside day band.

Visual weight: medium.

Treatment:

- visibly firmer than a suggestion
- clear remove or move action
- no calendar-write implication

Must not look like:

- hard booking
- calendar event
- locked schedule
- system-owned plan

## 15. Open capacity block

Purpose: mark possible planning space.

Emotional meaning: possible, not automatically consumed.

Surface: Plan day band.

Visual weight: medium in Plan.

Treatment:

- calm fill
- explicit label
- show that it is possible space, not empty ownership

Must not look like:

- blank time the app owns
- hard availability
- slot to be filled automatically

## 16. Protected time block

Purpose: show time the app should leave alone by default.

Emotional meaning: boundary.

Surface: Plan day band with firmer rule/fill.

Visual weight: medium.

Treatment:

- label as Protected or Leave alone
- visually unavailable but not alarmed
- no conflict styling by default

Must not look like:

- error
- blocked productivity
- unavailable because something went wrong

## 17. Useful window and time edge

Purpose: show when an action is useful.

Emotional meaning: fit, timing, context.

Surface: edge rule, note line, or band annotation.

Visual weight: medium, increasing only when relevant.

Treatment:

- text first
- edge/position second
- colour third
- no alarm styling by default

Variants:

- Fixed at: pinned point
- Due by: end-cap rule
- Useful until: fading boundary
- Latest useful start: pre-edge note
- Minimum still helps: supportive secondary line

Must not look like:

- overdue badge
- failure state
- urgent alert
- countdown pressure

## 18. Minimum done state

Purpose: acknowledge the smallest useful completion.

Emotional meaning: enough for now.

Surface: current Today object or task row state.

Visual weight: medium.

Treatment:

- quiet check/settle state
- no reward loop
- no confetti
- retain context briefly

Must not look like:

- performance achievement
- gamified milestone
- streak progress

## 19. Reset relief action

Purpose: reduce overwhelm and re-enter safely.

Emotional meaning: relief.

Surface: contextual bottom sheet action.

Visual weight: medium when invoked.

Treatment:

- explain what changes
- explain what remains safe
- show no more than 2–4 relief actions
- provide close/cancel

Must not look like:

- destructive reset
- emergency page
- punishment
- data loss

## 20. Backup/check status

Purpose: show local-first backup/check confidence.

Emotional meaning: trustworthy receipt.

Surface: receipt row or compact status block.

Visual weight: low to medium.

Treatment:

- last checked/exported time
- result in plain language
- next safe action
- no technical jargon unless expanded

Must not look like:

- developer console
- cloud sync dashboard
- warning system

## 21. Local-first account state

Purpose: explain identity/privacy boundary.

Emotional meaning: private by default.

Surface: Settings note or status row.

Visual weight: low.

Treatment:

- “Stored on this device” style language
- clear distinction between login and sync
- no cloud assumption

Must not look like:

- SaaS account dashboard
- analytics/tracking disclosure afterthought
- cloud storage upsell

## 22. Forbidden object states

Do not create visible states named or styled as:

- overdue
- late
- failed
- behind
- catch up
- streak
- score
- productivity score
- compliance
- penalty
- missed streak

Use instead:

- useful before
- useful until
- fixed at
- minimum still helps
- parked
- not today
- bring back later
- no longer needed
- safely held

## 23. Implementation checklist

Any PR that adds or changes a product object should specify:

- object type
- object hierarchy level
- allowed surface
- visible state labels
- interaction consequences
- recovery path
- forbidden copy checked
- colour-not-alone check
- reduced-motion check if motion exists
