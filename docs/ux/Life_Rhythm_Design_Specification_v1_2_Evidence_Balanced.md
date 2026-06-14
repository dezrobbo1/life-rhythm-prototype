**Rebalance statement**: Version 1.2 corrects evidence-weighting drift. Packets 22 and 25 remain global constraints for sensory/visual load and calendar/load realism, but they are no longer treated as the main proof for every screen. Each screen now has named primary packets and domain-specific boundary requirements.

# Life Rhythm Design Specification v1.2 - Evidence Balanced

Implementation-ready design-system specification with packet-balanced evidence mapping.

## 1. What changed in v1.2

Version 1.2 does not change the approved design direction. It changes the evidence weighting, documentation structure and implementation traceability so that Packets 1-25 are represented according to their actual role.

## 2. Balanced evidence hierarchy

**Evidence rule**: Use the packet that matches the feature. Do not use broad global packets as a substitute for domain packets. Packet 22 governs sensory/visual/interruption load. Packet 25 governs fixed commitments, buffers, hidden edges and soft planning. Other packets drive their own product areas.

## 3. Packet-by-packet design coverage

Every packet must have a visible path into implementation. Some packets are architecture-level, some are category-specific, and some are guardrails. This table is the anti-bias check for implementation reviews.

## 4. Screen-by-screen evidence responsibilities

Each screen must cite its true primary packets in implementation notes and QA. Packet 22 and Packet 25 should only be used as the headline evidence where the screen genuinely concerns sensory/visual load or calendar/load realism.

## 5. Product promise and design principles

Life Rhythm helps adults with ADHD choose the next realistic action without shame, overload or task flooding. It remains a non-clinical, local-first self-management app.

- Start small. Keep rhythm.
- One clear next action before details.
- Minimum counts.
- No catch-up pile.
- Library enables rhythms; Today acts on tasks.
- Plan shows shape, not pressure.
- Reset is relief, not failure.
- Themes change colour only.
- Sensitive domains keep explicit boundaries.
- Local-first and user-controlled by default.

## 6. App shell and themes

Use the fixed bottom navigation: Today, Plan, Library, Reset, Setup.

Approved themes:

- Exhale: default warm calm theme.
- Clear: higher-contrast structured theme.
- Grounded: warmer organic theme.

Themes change colour only. They must not change layout, copy, task logic, scheduling, data, boundaries or behaviour.

## 7. Today - re-entry surface

**Primary evidence**: Packets 1, 9, 11, 12 and 20. Secondary: 21, 22, 25. Today is not primarily a sensory-load or calendar-load screen; it is a re-entry and task-initiation surface.

- Default hierarchy: greeting/date, How today feels, plan-adjusted line, one next useful action, Start Boost/Done/Not now/Too much today, compact rhythm preview.
- States: Normal day, Behind/missed things, Low energy, Overstimulated, Avoiding something, Need restart, Bored/low stimulation.
- Bored/low stimulation is not overstimulated; offer useful stimulation such as change location, make it visible, gentle sound or pair with movement.
- Completion language: Minimum done, That counts, Enough for now.
- No overdue, failed, streak, score, compliance or productivity language.

## 8. Task card - calm action card

**Primary evidence**: Packets 12, 24 and 20. Secondary: 2, 11, 25. Task cards are not database records or schedule blocks.

Default visible content:

- icon
- title
- one-line purpose
- recommended size
- up to two chips
- one primary action
- Start Boost
- Details

Hidden behind Details:

- Why this?
- versions
- timing reality
- hidden edges
- edit, move and delete controls
- source/template metadata
- scheduling logic
- history

## 9. Start Boost - friction reducer

**Primary evidence**: Packets 24, 12 and 21. Secondary: 20, 22, 25. Start Boost is not a dopamine system, reward loop or urgency engine.

Optional feedback after use: "Did that help you start? Yes / A bit / No / Made it harder / Skip." Store only taskId, barrier, supportId, result and timestamp. Do not show success rates on the daily UI.

## 10. Plan - soft rhythm scaffold

**Primary evidence**: Packets 25, 11 and 19. Secondary: 12, 20, 22. Packet 25 is correctly primary here, but Plan must not become rigid time blocking.

- Fixed commitments appear before flexible actions.
- Hidden edges are collapsed by default: prep, travel, setup, cleanup, transition, decompression.
- Use time ranges, not false precision.
- Evening block must not become a leftover-task dumping ground.
- No red overdue/failure states.

Plan block states:

- Free
- Light
- Planned
- Heavy
- Fixed
- Wind down
- Restart point

## 11. Library - rhythm catalogue

**Primary evidence**: Packets 12, 9 and 11 plus category-specific packets 13-19 and 21-24. Do not use only Packets 22/25 to justify Library.

Rules:

- Enable rhythm means it can appear when relevant.
- Add to Today now means put it into Today immediately.
- Disable means keep it but stop using it.
- Remove from my library applies to built-in local copies.
- Delete custom template applies only to user-created templates.
- Quick packs enable rhythms, not Today task piles.

## 12. Reset - relief valve

**Primary evidence**: Packets 1, 9 and 20. Secondary: 25 and 22. Reset must lead with re-entry and shame-safe recovery, not calendar/load language.

Reset actions:

- Too much today
- Move extras
- Restart with one action
- Review tomorrow
- Reset whole app, separated and protected

Reset rules:

- Hide or move; do not delete unless explicitly destructive.
- Full app reset requires typed confirmation.
- No catch-up pile.
- No missed-again language.

## 13. Setup and Dev Tickets

**Primary Setup evidence**: Packets 10, 11, 15 and 23. Secondary: 22, 24, 25. Setup is not an admin console. Dev Tickets are not a support desk.

- Setup rows: Appearance, Dev tickets, Data and backup, Start Boost safety, About Life Rhythm, Advanced.
- Appearance is one setting: Exhale, Clear, Grounded.
- Start Boost safety exclusions: avoid food rewards, shopping rewards, scrolling rewards, urgency countdowns, accountability prompts, streak pressure.
- Data copy: Stored in this browser. Export before resetting. You control what you share.
- Dev Tickets live in Setup, not Today. They support local note capture, Markdown copy and JSON export/import only. No backend, assignment, due dates or notifications.

Single ticket Markdown output must include title, priority, status, area, app version, created date, description, expected behaviour, actual behaviour, steps to reproduce and screenshot note. Copy all open tickets must include a summary count and then ticket blocks.

## 14. Add/Edit Task - simple first

**Primary evidence**: Packets 12, 24 and 11. Secondary: 20, 25, 22. Add/Edit Task is not the whole task model.

- Just for today defaults to active task and Show today.
- Repeating rhythm defaults to enabled library rhythm and does not enter Today automatically.
- Save actions change by mode: Add to Today, Save rhythm, Save and add to Today, Save changes, Save template.
- Active task edit does not silently edit template. Template edit does not silently edit existing active instances.
- Delete confirmations must say what stays.

## 15. Empty, error and destructive states

**Primary evidence**: Packets 1, 9, 20 and 11. Secondary: 12, 22, 25. These states reduce uncertainty, not add a new task.

## 16. App-wide component rules

- One clear primary action per screen, card or modal.
- Details only when requested.
- Maximum two visible chips on cards.
- No exposed scheduler/debug machinery on daily screens.
- No full task database record shown by default.
- Boundary notes appear in Details, relevant Library/Add/Edit contexts and Setup, not on every card face.

## 17. Do-not-build guardrails

- No diagnosis, treatment, therapy, crisis support, medical advice or replacement for care.
- No financial advice, budgeting/debt/investment guidance, or moral judgement around spending.
- No nutrition advice, dieting, calorie tracking, weight-loss framing or eating-disorder treatment.
- No exercise prescription, rehab, intensity targets, physiotherapy or performance claims.
- No HR/legal/accommodation advice or employer monitoring.
- No hidden social monitoring, public failure boards, leaderboards or pressure accountability.
- No streaks, points, badges, levels, productivity scores, or guilt-based retention.
- No dopamine-hack language, manipulative urgency, forced countdowns or reward loops.
- No default calendar integration, automatic rescheduling loop, rigid time blocking or reminder floods.
- No debug/status machinery on daily screens.

## 18. Implementation phases and QA gates

Recommended sequence:

1. Theme tokens, app shell, navigation, typography and component primitives.
2. Today, Task Card and Start Boost.
3. Plan, Library and Reset.
4. Setup, Add/Edit Task and Dev Tickets.
5. Empty/error/destructive states, regression QA and cache/version bump.

## 19. Acceptance criteria

- The source-of-truth evidence table references all packets 1-25.
- Every screen lists true primary and secondary packets.
- Packet 22/25 are not used as headline evidence except where appropriate: visual/sensory/digital load and calendar/load realism.
- Today can be understood in under three seconds.
- A task card has one obvious primary action.
- Library never floods Today.
- Plan never becomes a rigid calendar.
- Reset feels like relief, not failure.
- Add/Edit Task works with minimum required fields only.
- Dev Tickets are local, copy-ready and invisible from daily-use screens.
- Sensitive category boundaries appear in Details, relevant Library/Add/Edit contexts and Setup, not on every card face.
- All themes preserve layout, behaviour, copy, data and safety rules.

## 20. Implementation authority

This v1.2 document supersedes v1.1 for evidence weighting and implementation traceability. The design boards remain visual references. If a board implies a pattern that conflicts with this document, implement this document. If this document is silent about visual polish, use the boards for visual direction.

**Final implementation instruction**: Build a calm design system first. Do not add new clinical, calendar, analytics, social, productivity or reward features during the design-system pass. Preserve existing task/library/reset behaviour unless the spec explicitly changes surface presentation or clarifies an action.
