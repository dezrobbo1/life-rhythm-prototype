# Life Rhythm Visual Design Direction Contract

Status: Design contract
Scope: Visual direction, surface hierarchy, anti-patterns, and first redesign boundaries
Source basis: Applied ADHD UX/UI research, Life Rhythm current design spec, soft scheduling loop contract, current design boards, and source packets

## 1. Purpose

This contract prevents Life Rhythm from drifting into a generic AI-coded, SaaS, shadcn-style, or dashboard-like product surface.

The goal is not decoration. The goal is a stable visual grammar that supports ADHD-sensitive task capture, soft scheduling, re-entry, and calm daily use.

## 2. Product centre

The design centre remains:

> Power underneath. Calm on the surface.

The desired user feeling remains:

> I can trust this to hold things for me without it turning my life into a dashboard.

The interface must feel:

- specific to Life Rhythm
- mature
- calm
- private
- tactile
- non-generic
- ADHD-sensitive
- themeable
- implementable

It must not feel like:

- a generic AI chat app
- a shadcn/Tailwind demo
- a SaaS dashboard
- a productivity command centre
- a habit-streak app
- a task-manager clone
- a calendar replacement
- a clinical app
- a gamified ADHD tool
- a life optimizer

## 3. Primary direction

Primary visual direction: **Soft Ledger**

Soft Ledger means Life Rhythm should feel like a calm record of what is held, available, protected, placed, or released. It should use quiet structure, rows, rules, bands, ledgers, and plain-language object states.

Soft Ledger is not a spreadsheet, accounting app, dashboard, or metric system. It is a gentle record system for rhythm and re-entry.

Supporting sub-metaphor: **Holding Tray**

Holding Tray applies primarily to Task Pool, parked tasks, not-today items, deferred items, and re-entry states. It should make items feel safely held rather than queued, late, or owed.

Fallback direction: **Rhythm Notebook**

Rhythm Notebook may guide tone, typography, section language, and lightweight tactile cues. It should not turn into decorative paper skeuomorphism or handwritten novelty.

## 4. Current design risk diagnosis

The current design direction is calm and coherent, but its visual language still risks generic AI-coded UI through:

- rounded cards everywhere
- boxed panels everywhere
- pill chips used as visual texture
- generic icon badges
- equal-weight surfaces
- soft shadows
- bottom toolbar that resembles a standard mobile SaaS shell
- component-board layout rather than product-object layout
- similar screen composition across Today, Plan, Library, Reset, and Setup

The problem is cumulative. A single rounded card is not the issue. A whole product made from rounded cards, chips, badges, and equal panels is the issue.

## 5. Visual anti-pattern catalogue

Avoid:

- chat-first centre
- AI sparkle, magic wand, or assistant motifs
- purple-blue intelligence gradients
- dashboard metrics
- habit streaks
- scores
- gamified completion treatment
- card soup
- pill-chip overload
- generic icon badges
- boxed every-section layout
- everything having equal visual weight
- soft-shadow SaaS depth
- grey-on-grey low contrast
- fake calm pastel sameness
- medical/wellness cliché styling
- childish ADHD visuals
- excessive empty-state illustration
- fake urgency badges
- notification-led design
- red overdue/late state styling
- calendar-grid ownership of the day

## 6. Surface hierarchy

Life Rhythm should use this hierarchy:

1. **Ledger rows** — default surface for most objects.
2. **Holding trays** — grouped rows that are safely held together.
3. **Day bands** — Plan-specific surfaces for broad day shape.
4. **Ruled sections** — quiet structural grouping.
5. **Bottom sheets** — contextual relief and short decision surfaces.
6. **Cards** — rare, used only for the dominant active object or focused confirmation content.

### Default section pattern

Default sections should use:

- heading
- short helper line only when needed
- rows or ruled content beneath
- no enclosing card unless containment is essential

### Primary object pattern

One screen may have one dominant contained object. Today should usually have one dominant next-action object. Other sections should not compete visually with it.

### List row pattern

Rows should contain:

- title
- one useful secondary line
- optional metadata line
- optional decision action

Rows should not contain decorative chip clusters or repeated icon badges.

### Tray pattern

Trays group held items. A tray may have a subtle background or rule, but should not become a stack of nested cards.

### Day band pattern

Plan uses broad bands such as Morning, Midday, Afternoon, Evening. Bands represent day shape, not a calendar grid.

### Modal and sheet pattern

Use full modals for forms. Use bottom sheets for contextual relief, re-entry choices, and small action sets.

## 7. Card rules

Do not use cards as the default section container.

Use cards only when:

- the object is the single dominant focus on a screen
- the object needs temporary containment for a decision
- the content is a focused confirmation or review surface

Avoid:

- one card per section by default
- nested cards
- identical rounded cards stacked down a screen
- cards used only to create visual rhythm

## 8. Radius, borders, and shadow rules

Radius should be restrained. The app should feel tactile, not inflated.

Use:

- small radius for rows and chips
- moderate radius for primary objects and sheets
- no excessive capsule rounding unless the element is an actual control

Borders should do more work than shadows.

Use shadows rarely. When used, they should separate layers, not create floating SaaS panels.

Depth levels:

1. page
2. quiet surface
3. dominant object
4. sheet/modal

Do not create additional informal depth levels.

## 9. Chip and metadata rules

Replace decorative chips with metadata lines.

Use chips only when:

- the chip is an interactive choice
- the chip communicates a decision-relevant state
- the chip needs to be scanned quickly as a category

Do not use chips merely for:

- area labels
- every status
- every duration
- every screen section
- creating texture

Metadata line example:

`Home · Minimum version: clear the bench · Useful before evening`

## 10. Icon rules

Icons should be sparse and functional.

Use icons for:

- navigation marks
- a few repeated product object marks
- high-value actions where the icon is widely recognisable

Avoid:

- generic icon badges beside every panel
- decorative icons in every card header
- sparkle/magic/AI icons
- icon-only navigation
- icon-only destructive or state-changing actions

## 11. Navigation direction

Primary navigation should be quiet and label-led.

Recommended visible destinations after onboarding:

- Today
- Plan
- Pool
- Library

Contextual or secondary destinations:

- Reset / Relief
- Settings / Setup
- Backup / Check

Reset should be a contextual relief pathway, not a permanent peer of Today and Plan.

Setup should move into Settings after onboarding.

Navigation must not use badges, scores, streaks, overdue counts, or pressure indicators.

## 12. Screen direction rules

### Today

Today should have one visually dominant object: the next useful action.

Above the fold should contain:

- day context line
- next action object
- primary action
- quiet exits such as Park, Not today, or Stop here

Hide secondary detail until expanded.

### Pool

Pool should feel like a Holding Tray, not a backlog.

Use grouped ledger rows. Do not show red counts, overdue piles, or guilt-list formatting.

Preferred groups:

- Captured
- Parked
- Not today
- Bring back later
- Repeating later
- No longer needed, collapsed

### Plan

Plan should feel like a day-shape map, not a calendar replacement.

Use day bands and soft placement strips. Do not use an hourly grid by default.

Open capacity should appear as possible planning space. Protected time should appear unavailable without alarm styling.

### Library

Library should feel like an index shelf or reusable rhythm shelf.

Do not use streak, compliance, habit-chain, or performance visuals.

### Reset / Relief

Reset should feel supportive, not catastrophic.

Use a contextual relief sheet. Always explain what changes and what stays safe.

### Setup / Settings

Setup should feel like shaping space, not configuring a control room.

Use progressive disclosure, previews, and plain-language consequences.

## 13. First visual redesign pass scope

The first redesign pass should include:

1. shell and navigation reduction
2. Today dominant-object hierarchy
3. Pool as Holding Tray with ledger rows
4. Plan as day bands
5. chip reduction
6. semantic theme token alignment
7. Reset as contextual relief sheet

Do not include yet:

- new illustrations
- broad animation work
- custom font experiments
- calendar integration
- AI surfaces
- analytics or metrics
- task history dashboards
- full visual redesign of every detail

## 14. Implementation boundaries

This contract is design direction only. It does not approve:

- backend work
- cloud sync
- analytics
- AI features
- calendar writes
- notifications
- import/restore execution
- task history
- completion logs

Future implementation PRs must state which screen, object, or surface rule they touch.
