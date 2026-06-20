# Life Rhythm Navigation Redesign Contract

Status: Design contract
Scope: Top-level navigation, contextual relief entry, settings visibility, and navigation anti-patterns
Source basis: Applied ADHD UX/UI research, current design spec, current design boards, and mobile navigation guidance

## 1. Purpose

This contract defines the intended Life Rhythm navigation model before any visual shell implementation work.

The goal is to keep navigation discoverable and low-friction while removing the generic five-tab productivity-app feel.

## 2. Core navigation principle

Navigation should help the user answer:

- What can I do now?
- Where are things safely held?
- Where can I softly place something?
- Where are my reusable rhythms?
- Where can I get relief if today is too much?

Navigation must not imply:

- all sections are equally important every day
- Reset is a destructive destination
- Setup is a daily task
- the app owns the whole day
- tasks are debts to be cleared

## 3. Recommended primary navigation

After onboarding, use four primary destinations:

1. **Today**
2. **Plan**
3. **Pool**
4. **Library**

This keeps primary navigation focused on the everyday loop:

capture / hold → see today → place softly → reuse rhythms

## 4. Destination responsibilities

### Today

Purpose: one useful next action and immediate re-entry.

Today owns:

- current next action
- start / pause / resume
- minimum done
- stop here
- park
- not today
- contextual relief entry

Today must not become:

- full task list
- dashboard
- calendar
- analytics page

### Plan

Purpose: day shape, open capacity, soft suggestions, and user-confirmed soft placements.

Plan owns:

- open capacity
- protected time visibility
- soft suggestions
- soft placements
- broad day bands
- usefulness-window context

Plan must not become:

- calendar replacement
- rigid timetable
- automatic scheduler authority
- full backlog planner

### Pool

Purpose: safely held tasks and re-entry objects.

Pool owns:

- captured tasks
- parked tasks
- not-today tasks
- deferred tasks
- future rhythm instances when implemented
- no-longer-needed items in a collapsed/quiet area

Pool must not become:

- backlog
- inbox zero system
- task debt list
- overdue queue
- guilt ledger

### Library

Purpose: reusable rhythms and rhythm templates.

Library owns:

- saved rhythms
- custom rhythm templates
- future rhythm packs
- repeating rhythm source definitions

Library must not become:

- habit-streak tracker
- compliance catalogue
- performance list

## 5. Contextual and secondary destinations

### Reset / Relief

Reset should not be a persistent tab.

Reset should be available as:

- contextual relief button/link from Today
- contextual relief option from Plan
- optional secondary entry from Settings/overflow

Preferred label in UI:

- Reset
- Relief
- Make today smaller

Use the clearest label in testing. Avoid dramatic language.

Reset should open as a contextual sheet, not a full permanent destination by default.

### Setup / Settings

Setup should not remain in primary navigation after onboarding.

Setup should move into:

- Settings
- Life Shape
- Backup and check
- Appearance / Theme

Settings may be accessible from a top-right or overflow control.

Do not use a permanent Setup tab in the daily shell.

## 6. Pool naming

Recommended model:

- tab label: **Pool**
- screen heading: **Task Pool** or **Holding Tray** depending on testing
- helper copy: “Captured and parked tasks are safely held here.”

Rationale:

- “Pool” is short enough for nav
- “Task Pool” has stronger information scent
- “Holding Tray” carries emotional meaning but may be too metaphorical as a nav label
- “Inbox” risks email/backlog associations
- “Held” is gentle but abstract

Prototype testing should compare:

- Pool
- Task Pool
- Held
- Tray

Do not use:

- Backlog
- Queue
- Pending
- To do
- Overdue

## 7. Bottom navigation visual rules

Bottom navigation may remain, but it must become visually quiet.

Rules:

- label-led
- no badges
- no counters
- no streak/status indicators
- restrained icons
- clear selected label
- quiet top rule or surface separation
- no floating pill dock style
- no bright active bubble
- no generic SaaS glow
- no decorative icon circles

The selected tab should be clear through label weight, position, and small accent. It should not rely only on colour.

## 8. Icon rules for navigation

Use icons only if they improve recognition.

Recommended icon meaning:

- Today: simple sun/day mark or current-action mark
- Plan: day-band or path mark
- Pool: tray/held-stack mark
- Library: shelf/index mark

Avoid:

- generic dashboard grid
- AI sparkle
- rocket
- trophy
- flame
- calendar-first icon for Plan
- checklist-only icon for Pool
- clinical/medical marks

All nav items must have visible labels.

## 9. Reset sheet entry rules

A Reset / Relief sheet should:

- open from Today or Plan
- preserve screen context behind it
- explain that nothing is lost
- show 2–4 relief actions maximum
- make consequences clear
- include cancel/close
- avoid destructive styling unless an action is truly destructive

Possible relief actions:

- Show me one thing
- Park extras safely
- Bring back later
- Restart from the minimum

Avoid:

- Full reset now
- Clear everything
- Delete today
- Start over from failure
- Catch up

## 10. Settings entry rules

Settings should hold:

- Life Shape
- Theme / appearance
- Backup and check
- Account / trial boundary, when present
- About / privacy language

Settings should not appear as a daily destination after onboarding.

If early trial users need easy access to Setup, use a temporary top-right Settings affordance rather than a fifth nav tab.

## 11. Onboarding and post-onboarding behaviour

During onboarding:

- Setup may be primary
- Life Shape may be prominent
- theme choice may be optional
- backup/check may be introduced gently

After onboarding:

- Setup moves to Settings
- Today becomes default start point
- four-tab navigation becomes primary
- Reset is contextual

## 12. Navigation anti-patterns

Do not add:

- five equal tabs after onboarding
- tab badges
- overdue counts
- urgent nav states
- hidden hamburger-only primary nav
- dashboard home as default
- AI assistant tab
- Calendar tab before calendar integration is explicitly approved
- Reset as a red emergency tab
- Setup as a daily destination

## 13. Codex-safe implementation notes

When implementing navigation changes:

- keep existing routes stable where possible
- do not delete Setup functionality
- move Setup access rather than removing it
- do not change data schemas
- do not add analytics
- do not add notifications
- do not add AI
- do not add calendar integration
- keep labels plain and visible
- update tests for visible nav destinations
- verify keyboard and screen-reader labels

## 14. Validation checklist

A navigation PR should verify:

- Today, Plan, Pool, and Library are visible top-level destinations
- Reset is accessible contextually
- Setup/Settings remains accessible
- no nav badges or counters exist
- no forbidden pressure copy exists
- current route is visibly selected without relying only on colour
- protected root files are unchanged
- app behaviour/data writes are unchanged unless explicitly scoped
