# Life Rhythm Design Specification v1.2 — Evidence Balanced

Status: **Historical evidence-balanced UX reference — v1.2 checkpoint. Not current product or implementation authority.**

This document remains useful for packet/evidence weighting, screen-level research traceability and historical design rationale. It must not be used to override the current product/MVP direction.

Current authority is:

1. `PRODUCT.md` — product purpose, direction and true invariants.
2. `MVP_PLAN.md` — active MVP gates and success criteria.
3. `ARCHITECTURE.md` — target architecture and engineering boundaries.
4. Current code and tests — implemented runtime truth.
5. `docs/RESEARCH_BASIS.md` — evidence translation and scientific boundaries.
6. `docs/DOCUMENTATION_AUTHORITY.md` — repository documentation hierarchy.

Interpretation rule for the historical material below:

> Prescriptive wording such as “use”, “must”, “no”, “current”, “implementation-ready” or fixed screen/navigation rules describes the v1.2 design checkpoint unless independently reaffirmed by the current authority above. The packet mappings and evidence cautions remain useful research input; the old navigation, manual-only scheduling, no-calendar-integration and other product prescriptions are not current product prohibitions.

**Rebalance statement**: Version 1.2 corrected evidence-weighting drift. Packets 22 and 25 were treated as global constraints for sensory/visual load and calendar/load realism, rather than as the main proof for every screen. Each screen had named primary packets and domain-specific boundary requirements.

Historical runtime note: at the v1.2 checkpoint, `/app` implementation status, navigation, theme exposure and data boundaries were documented through `app/docs/life-rhythm-current-design-spec.md` and the then-current documentation map. That authority model has since been superseded.

Historical description: design-system specification with packet-balanced evidence mapping for the v1.2 checkpoint.

## 1. What changed in v1.2

Version 1.2 did not change the then-approved design direction. It changed evidence weighting, documentation structure and implementation traceability so that Packets 1-25 were represented according to their actual role.

## 2. Balanced evidence hierarchy

**Evidence rule**: Use the packet that matches the feature. Do not use broad global packets as a substitute for domain packets. Packet 22 governs sensory/visual/interruption load. Packet 25 governs fixed commitments, buffers, hidden edges and soft planning. Other packets drive their own product areas.

This evidence-weighting rule remains useful as research guidance, but it does not convert historical feature implementations into current product requirements.

## 3. Packet-by-packet design coverage

Every packet should have a visible path into evidence review. Some packets are architecture-level, some are category-specific, and some are guardrails. The original table was intended as an anti-bias check for implementation reviews.

## 4. Screen-by-screen evidence responsibilities

At the v1.2 checkpoint, each screen cited its primary packets in implementation notes and QA. Packet 22 and Packet 25 were intended to be headline evidence only where the screen genuinely concerned sensory/visual load or calendar/load realism.

## 5. Product promise and design principles

At the v1.2 checkpoint, Life Rhythm was described as helping adults with ADHD choose the next realistic action without shame, overload or task flooding, while remaining a non-clinical, local-first self-management app.

Historical design principles included:

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

Some of these ideas remain compatible with the current product direction, but their exact UI/object implementation is not protected by this document.

## 6. App shell and themes

At the v1.2 checkpoint, the primary navigation was Today, Plan, Pool and Library, with Reset and Settings secondary. This is historical implementation context, not a current navigation requirement.

Product-facing themes at that checkpoint were:

- Exhale: default warm calm theme.
- Clear: cool blue-green calm theme.
- Grounded: warm earth calm theme.

The historical theme rule was colour-only variation: themes were not intended to change layout, copy, task logic, scheduling, data, boundaries or behaviour.

The implementation token layer also contained Paper, Tide, Clay and Night. Exhale mapped to Paper, Clear to Tide, and Grounded to Clay. Night was not exposed by the then-current product selector.

## 7. Today — re-entry surface

**Primary evidence at the v1.2 checkpoint**: Packets 1, 9, 11, 12 and 20. Secondary: 21, 22, 25. Today was treated primarily as a re-entry and task-initiation surface rather than a sensory-load or calendar-load screen.

Historical UI hypotheses:

- Default hierarchy: greeting/date, How today feels, plan-adjusted line, one next useful action, Start Boost/Done/Not now/Too much today, compact rhythm preview.
- States: Normal day, Behind/missed things, Low energy, Overstimulated, Avoiding something, Need restart, Bored/low stimulation.
- Bored/low stimulation is not overstimulated; offer useful stimulation such as change location, make it visible, gentle sound or pair with movement.
- Completion language: Minimum done, That counts, Enough for now.
- No overdue, failed, streak, score, compliance or productivity language.

These are historical design hypotheses unless reaffirmed in current MVP work.

## 8. Task card — calm action card

**Primary evidence at the v1.2 checkpoint**: Packets 12, 24 and 20. Secondary: 2, 11, 25.

Historical default visible content:

- icon
- title
- one-line purpose
- recommended size
- up to two chips
- one primary action
- Start Boost
- Details

Historical details content:

- Why this?
- versions
- timing reality
- hidden edges
- edit, move and delete controls
- source/template metadata
- scheduling logic
- history

## 9. Start Boost — friction reducer

**Primary evidence at the v1.2 checkpoint**: Packets 24, 12 and 21. Secondary: 20, 22, 25. Start Boost was explicitly not framed as a dopamine system, reward loop or urgency engine.

Historical feedback hypothesis after use: “Did that help you start? Yes / A bit / No / Made it harder / Skip.” The then-proposed event shape stored taskId, barrier, supportId, result and timestamp and did not expose success rates on the daily UI.

## 10. Plan — soft rhythm scaffold

**Primary evidence at the v1.2 checkpoint**: Packets 25, 11 and 19. Secondary: 12, 20, 22.

Historical Plan hypotheses:

- Fixed commitments appear before flexible actions.
- Hidden edges are collapsed by default: prep, travel, setup, cleanup, transition, decompression.
- Use time ranges, not false precision.
- Evening block must not become a leftover-task dumping ground.
- No red overdue/failure states.

Historical Plan block states:

- Free
- Light
- Planned
- Heavy
- Fixed
- Wind down
- Restart point

The current MVP is free to replace this surface with a more automatic scheduler-backed daily experience.

## 11. Library — rhythm catalogue

**Primary evidence at the v1.2 checkpoint**: Packets 12, 9 and 11 plus category-specific packets 13-19 and 21-24.

Historical interaction rules included:

- Enable rhythm means it can appear when relevant.
- Add to Today now means put it into Today immediately.
- Disable means keep it but stop using it.
- Remove from my library applies to built-in local copies.
- Delete custom template applies only to user-created templates.
- Quick packs enable rhythms, not Today task piles.

These rules describe the old Library/Today model and are not current architecture constraints.

## 12. Reset — relief valve

**Primary evidence at the v1.2 checkpoint**: Packets 1, 9 and 20. Secondary: 25 and 22.

Historical Reset actions:

- Too much today
- Move extras
- Restart with one action
- Review tomorrow
- Reset whole app, separated and protected

Historical Reset rules:

- Hide or move; do not delete unless explicitly destructive.
- Full app reset requires typed confirmation.
- No catch-up pile.
- No missed-again language.

The broader non-punitive/re-entry rationale remains useful evidence input; exact Reset mechanics remain product hypotheses.

## 13. Setup and Dev Tickets

**Primary Setup evidence at the v1.2 checkpoint**: Packets 10, 11, 15 and 23. Secondary: 22, 24, 25.

Historical Setup hypotheses:

- Setup rows: Appearance, Dev tickets, Data and backup, Start Boost safety, About Life Rhythm, Advanced.
- Appearance is one setting: Exhale, Clear, Grounded.
- Start Boost safety exclusions: avoid food rewards, shopping rewards, scrolling rewards, urgency countdowns, accountability prompts, streak pressure.
- Data copy: Stored in this browser. Export before resetting. You control what you share.
- Dev Tickets live in Setup, not Today. They support local note capture, Markdown copy and JSON export/import only. No backend, assignment, due dates or notifications.

The historical single-ticket Markdown output included title, priority, status, area, app version, created date, description, expected behaviour, actual behaviour, steps to reproduce and screenshot note.

## 14. Add/Edit Task — simple first

**Primary evidence at the v1.2 checkpoint**: Packets 12, 24 and 11. Secondary: 20, 25, 22.

Historical hypotheses:

- Just for today defaults to active task and Show today.
- Repeating rhythms remain reusable Library templates. Enablement does not create a Today task automatically.
- Save actions change by mode: Add to Today, Save rhythm, Save and add to Today, Save changes, Save template.
- Active task edit does not silently edit template. Template edit does not silently edit existing active instances.
- Delete confirmations must say what stays.

The current MVP may replace these object distinctions where a simpler canonical life model reduces executive burden.

## 15. Empty, error and destructive states

**Primary evidence at the v1.2 checkpoint**: Packets 1, 9, 20 and 11. Secondary: 12, 22, 25. The historical objective was to reduce uncertainty rather than create additional user work.

## 16. App-wide component rules

Historical v1.2 component rules included:

- One clear primary action per screen, card or modal.
- Details only when requested.
- Maximum two visible chips on cards.
- No exposed scheduler/debug machinery on daily screens.
- No full task database record shown by default.
- Boundary notes appear in Details, relevant Library/Add/Edit contexts and Setup, not on every card face.

These remain design references, not current constitutional rules.

## 17. Do-not-build guardrails at the v1.2 checkpoint

The v1.2 document grouped both genuine safety boundaries and then-current product-scope exclusions together. They are separated here so the historical document does not create false current prohibitions.

Enduring evidence/safety cautions that remain relevant when consistent with current authority:

- No diagnosis, treatment, therapy, crisis support, medical advice or replacement-for-care claims.
- No financial advice, budgeting/debt/investment guidance, or moral judgement around spending.
- No nutrition advice, dieting, calorie tracking, weight-loss framing or eating-disorder treatment.
- No exercise prescription, rehab, intensity targets, physiotherapy or performance claims.
- No HR/legal/accommodation advice or employer monitoring.
- No hidden social monitoring, public failure boards, leaderboards or pressure accountability.
- No streaks, points, badges, levels, productivity scores, guilt-based retention or dopamine-hack claims.

Historical scope exclusions that **do not** bind the current adaptive MVP:

- default calendar integration;
- automatic rescheduling;
- scheduler-owned private placement;
- the old four-destination navigation model;
- rigid separation between Library/Today/Plan objects;
- the exact design-system implementation sequence below.

The current MVP explicitly investigates real calendar read, bounded automatic private scheduling/rescheduling and a simpler scheduler-backed daily surface under the safeguards in `PRODUCT.md`, `ARCHITECTURE.md` and `docs/RESEARCH_BASIS.md`.

## 18. Historical implementation phases and QA gates

The v1.2 checkpoint recommended this sequence:

1. Theme tokens, app shell, navigation, typography and component primitives.
2. Today, Task Card and Start Boost.
3. Plan, Library and Reset.
4. Setup, Add/Edit Task and Dev Tickets.
5. Empty/error/destructive states, regression QA and cache/version bump.

This sequence is superseded. Use `MVP_PLAN.md` for the current roadmap.

## 19. Historical acceptance criteria

The v1.2 checkpoint used acceptance criteria including:

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

These criteria are historical UX hypotheses and quality references, not the current MVP definition of done.

## 20. Historical implementation authority — superseded

Within the old v1.x documentation family, this v1.2 document superseded v1.1 for evidence weighting and implementation traceability. It no longer has authority over current product direction, navigation, scheduling behaviour, architecture or roadmap.

For current work:

- use `PRODUCT.md` for product purpose and true invariants;
- use `MVP_PLAN.md` for the active gate sequence;
- use `ARCHITECTURE.md` for system boundaries;
- use current code/tests for implemented runtime truth;
- use `docs/RESEARCH_BASIS.md` for evidence translation;
- use this document only for historical packet/evidence mapping and design rationale.

Historical final instruction at the v1.2 checkpoint was to build the calm design system first and preserve then-existing task/library/reset behaviour during that pass. That instruction is superseded by the adaptive MVP programme.
