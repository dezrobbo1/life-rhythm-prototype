# Rhythm Library Catalogue Gap Audit

Status: Reviewed catalogue gap audit; approved as product-planning input, not a runtime contract or implementation-status authority

Scope: Comparison of the current React Library catalogue and packs with the protected root 1.4.6 legacy catalogue, followed by bounded recommendations for a future recurring-rhythm catalogue

## 1. Purpose and Source Boundary

This audit identifies which existing ideas are suitable for a future Library of recurring rhythm templates, which belong in Task Pool or contextual support, and which need further product review.

Sources inspected:

- current React catalogue and packs in `app/src/features/library/mockLibraryData.ts`;
- current React Library composition and actions;
- current rhythm template schema;
- protected root `index.html` standard catalogue and packs.

The classifications and recommended pack direction in this reviewed audit are approved product-planning input. Exact final catalogue entries, taxonomy, defaults, recurrence values, and pack membership remain subject to the unresolved decisions in Section 14. Implementation must follow the approved rhythm recurrence and instance contract.

The protected root runtime is historical product evidence only. Its data model, scheduler, enablement behavior, packs, and copy are not authority for `/app` and must not be copied blindly.

Current implementation status remains governed by `life-rhythm-current-design-spec.md`.

## 2. Audit Classification

Each legacy idea is classified as one of:

- **Recurring rhythm candidate** — a reusable activity with a meaningful cadence.
- **Ad hoc Pool task** — a one-off task that belongs primarily in the Holding Tray.
- **One-time setup action** — configuration or onboarding rather than a recurring activity.
- **Contextual support rather than task** — useful in a state, transition, or Start Boost flow rather than as a recurrence.
- **Unsuitable or out of scope** — should not enter the recurring catalogue without a separate product/boundary decision.

Classification is not an implementation instruction. Exact final catalogue entries, taxonomy, defaults, recurrence values, pack membership, and copy remain subject to the unresolved decisions in Section 14 and separately reviewed implementation.

## 3. Current React Catalogue

The current React catalogue exposes 12 categories plus `All`:

- Sleep;
- Food;
- Anti-scroll;
- Household;
- Money;
- Movement;
- Work focus;
- Emotional recovery;
- Motivation;
- Sensory load;
- Social support;
- Start Boost.

It contains ten built-in entries:

| Current rhythm | Category | Initial preview state | Audit reading |
| --- | --- | --- | --- |
| Gentle wind-down | Sleep | Enabled | Recurring rhythm candidate; must remain non-clinical and optional. |
| Breakfast reset | Food | Disabled | Hybrid context/activity; must be separated from profile meal-window protection. |
| Phone park | Anti-scroll | Disabled | Usually contextual support, not an obvious time recurrence. |
| Kitchen landing | Household | Enabled | Recurring rhythm candidate. |
| Receipt drop | Money | Disabled | Recurring admin-cadence candidate; no financial advice. |
| Doorway stretch | Movement | Disabled | Recurring candidate when cadence is explicit and user-controlled. |
| Open the first file | Work focus | Enabled | Workday/profile-scoped recurring candidate. |
| Soft reset | Emotional recovery | Disabled | Contextual re-entry support rather than a default recurrence. |
| Quiet surface | Sensory load | Disabled | Usually contextual support; recurrence requires deliberate opt-in. |
| Draft one message | Social support | Disabled | Contextual or ad hoc action, not an obvious recurring rhythm. |

### Current Quick Packs

| Pack | Included entries |
| --- | --- |
| Morning basics | Breakfast reset; Kitchen landing |
| Focus without pressure | Phone park; Doorway stretch; Open the first file; Quiet surface |
| Evening soft landing | Gentle wind-down; Kitchen landing; Soft reset |

### Current behavior

- Built-in and custom enable/disable state is component-local preview state.
- A saved custom template persists with `enabled: false`; the form’s enablement choice lasts only in the current Library session.
- Reloaded custom templates appear disabled.
- Pack enablement is session-only and turns on every listed item.
- Pack preview does not allow individual deselection even though the action says “Enable selected rhythms.”
- `Add to Today now` creates an active task with the template ID and does not change Library enablement.
- Custom creation records title, category, purpose, versions, and preview enablement, but no complete recurrence rule.
- No generated rhythm instances exist.

These are implementation observations, not defects to fix in this documentation task.

### Current Personal Trial presentation

The current Personal Trial presentation makes Library look more one-off than its underlying reusable-template and preview-enablement code:

- `app/src/styles/personal-trial.css` hides the Library Enabled/Disabled state rendered by `app/src/features/library/LibraryRhythmCard.tsx`;
- the same Personal Trial CSS hides the first Library card action, which `LibraryRhythmCard.tsx` defines as Enable rhythm or Disable rhythm;
- the same CSS hides the Quick Packs section rendered by `app/src/screens/LibraryScreen.tsx`, including the preview/enable controls defined by `app/src/features/library/QuickPackCard.tsx`;
- `Add to Today now` is therefore the dominant visible action on each rhythm card;
- enablement remains component-local and session-only, and saved custom templates still reload disabled.

This presentation is not fixed by the current documentation work. When persistent `RhythmPlan` support is separately implemented, Library presentation must make the reusable recurring action primary and keep Add to Today once as the secondary one-occurrence override.

## 4. Current Catalogue and Taxonomy Gaps

### Empty or misleading categories

- **Motivation** and **Start Boost** contain no built-in entries.
- Start Boost is a contextual support mechanism, not naturally a rhythm category.
- Motivation and Start Boost both map to schema area `other`; a custom Start Boost entry reloads as Motivation.
- Schema area `admin` maps to Household, while the Library exposes no Admin category.
- Schema area `health` maps to Sleep, which is too broad for a future catalogue.
- Anti-scroll, Emotional recovery, Sensory load, and Social support mix situational scaffolds with recurring activities.
- Food currently mixes meal context with preparation/household activity.
- Most categories contain only one item, so the category count overstates catalogue breadth.

### Pack and metadata gaps

- `admin-light-touch` appears in rhythm `packIds` but no corresponding current pack exists.
- Pack membership is hard-coded and not persistent user intent.
- There is no recurrence/profile preview before enabling.
- There is no individual deselection.
- Overlapping pack membership has no durable ownership rule.

### Model gaps

The current rhythm template schema includes minimum/normal/full versions and older schedule hints, but it lacks:

- complete interval recurrence;
- anchor dates;
- exact fortnightly behavior;
- applicable day profiles;
- persistent rhythm plans;
- planning mode;
- stable occurrence identity;
- rhythm instances;
- instance deduplication;
- completion state separate from template state.

These gaps are addressed conceptually by `rhythm-recurrence-and-instance-contract.md` and remain unimplemented.

## 5. Protected Legacy Catalogue Classification

The root 1.4.6 catalogue contains 17 standard items.

| Legacy item | Classification | Audit rationale |
| --- | --- | --- |
| Morning get ready and leave | Recurring rhythm candidate | Plausible profile-scoped leaving routine; exact event/checklist boundary needs review. |
| Eat breakfast | Contextual support rather than task | Meal context should protect time and must not automatically create a food task. |
| Plan dinner | Recurring rhythm candidate | Clear recurring preparation activity. |
| Grocery list | Recurring rhythm candidate | Clear weekly activity. |
| Restock emergency meals | Recurring rhythm candidate | Repeatable stock check; no nutrition or dieting advice. |
| Gym | Recurring rhythm candidate | Strong flexible-quota example. |
| Stretch / mobility | Recurring rhythm candidate | Strong flexible-quota example. |
| First work focus block | Recurring rhythm candidate | Workday/profile-scoped recurring activity. |
| Review tomorrow | Recurring rhythm candidate | Strong selected-workday cadence. |
| Kitchen reset | Recurring rhythm candidate | Repeatable household activity. |
| Laundry | Recurring rhythm candidate | Repeatable household activity. |
| Pay or check one bill | Ad hoc Pool task | The specific bill is one-off; a separate monthly money review may be a rhythm. |
| Spending pause | Unsuitable or out of scope | Situational financial support, not recurrence; needs a separate boundary decision. |
| Anti-scroll pause | Contextual support rather than task | Just-in-time scaffold, not a useful completion quota. |
| Sensory decompression | Contextual support rather than task | Normally state/transition-led; recurring use would require explicit opt-in. |
| Emotional recovery reset | Contextual support rather than task | Re-entry support should respond to context, not create adherence. |
| Ask for body double | Contextual support rather than task | Support tool when useful; a specific outreach can instead be an ad hoc Pool task. |

No legacy standard catalogue item is clearly a one-time setup action. Work hours, meal context, preferred days, and day-profile configuration belong in Settings rather than the recurring Library.

### Legacy starter set

The legacy starter set enabled:

- Eat breakfast;
- Gym;
- First work focus block;
- Kitchen reset;
- Anti-scroll pause.

The future `/app` must not silently enable this set. Several entries need reclassification, and persistent enablement requires explicit user selection and a valid rhythm plan.

## 6. Protected Legacy Pack Findings

| Legacy pack | Future treatment |
| --- | --- |
| Workday basics | Useful source for Workday foundations after meal and contextual-support entries are separated. |
| Low-energy day | Useful source for Low-capacity week, but must not turn a difficult week into a larger obligation set. |
| House reset | Useful source for Home maintenance. |
| Food rhythm | Useful source after Eat breakfast is separated from profile meal context. |
| Movement week | Strong source for the future Movement week pack. |
| Leaving the house | Better folded into Workday foundations or a later profile-scoped leaving pack. |
| Shutdown evening | Useful source for Evening close after contextual recovery entries are reviewed. |

Legacy enablement was persistent, but templates entered the legacy scheduler directly. It did not create stable separate instances. Its recurrence model did not represent anchored fortnightly behavior accurately and could increase pressure near a period boundary. Those behaviors must not be copied.

## 7. Proposed Initial Catalogue Direction

The first curated catalogue should be deliberately smaller than the total idea list and contain only entries with clear recurring identity.

Candidate recurring templates:

### Work and transitions

- Open the first work item / First work focus block;
- Review tomorrow on applicable Workday profiles;
- optional profile-scoped leaving routine.

### Food preparation and access

- Plan dinner;
- Pack lunch;
- Grocery list;
- Restock emergency meals;
- Breakfast reset only if rewritten as preparation/access rather than eating compliance.

### Movement

- Gym;
- Stretch / mobility;
- Doorway stretch as a small transition alternative.

### Home maintenance

- Kitchen landing/reset;
- Laundry;
- Replace bedding fortnightly.

### Administration

- Receipt drop;
- weekly paperwork/admin review;
- monthly money review with organisation-only boundaries.

### Evening

- Gentle wind-down;
- Review tomorrow where the day profile applies;
- Kitchen landing.

Contextual supports such as Soft reset, Phone park, Quiet surface, Anti-scroll pause, and Ask for body double should remain outside the first recurring set unless a user explicitly turns a reviewed version into a recurrence.

## 8. Proposed Initial Pack Set

Pack contents are candidate defaults. The user must be able to preview, deselect, and edit recurrence before turning them on.

| Pack | Candidate contents | Notes |
| --- | --- | --- |
| **Workday foundations** | First work focus; Review tomorrow; optional leaving routine | Applies to selected Workday profiles. Do not add unrelated personal tasks inside work hours. |
| **Non-workday foundations** | Kitchen landing; Gentle wind-down; optional Plan dinner | Needs a distinct reviewed non-workday opening rhythm rather than padding with contextual supports. |
| **Food rhythm** | Plan dinner; Pack lunch; Grocery list; Restock emergency meals | Meal windows stay in day profiles and do not become tasks. |
| **Movement week** | Gym; Stretch/mobility; optional Doorway stretch | Flexible quota is suitable for gym/mobility; no exercise prescription. |
| **Home maintenance** | Kitchen reset; Laundry; Replace bedding fortnightly | Cadence remains editable and minimum versions count. |
| **Admin cadence** | Receipt drop; weekly admin review | Specific bills, forms, and calls remain ad hoc Pool tasks. |
| **Evening close** | Gentle wind-down; Review tomorrow; Kitchen landing | Profile applicability and timing remain editable. |
| **Low-capacity week** | Provisional reviewed set of minimum-friendly recurring templates; exact membership unresolved | It cannot be generated dynamically from already-enabled rhythms while a pack is defined as a curated template collection. Whether this becomes a true pack or a temporary contextual configuration remains unresolved. |
| **Monthly life admin** | Money review; paperwork review; selected renewal checks | Organisation only; no financial, legal, or compliance advice. |

Packs may share templates. Selecting the same template through two packs must produce one rhythm plan, not duplicate plans or instances.

## 9. Future Pack Contract Requirements

A future pack must:

- preview every included rhythm;
- allow individual deselection;
- show proposed recurrence and applicable profiles;
- allow recurrence/profile review before activation;
- turn on only selected templates;
- persist rhythm plans;
- avoid duplicate activation across overlapping packs;
- never dump all entries into Today;
- explain that Add to Today once is a separate one-occurrence override;
- preserve user customizations when the curated pack definition changes.

Pack language must avoid challenge, streak, score, catch-up, and compliance framing.

## 10. Library, Pool, Plan, and Today Boundaries

- Library owns reusable rhythm templates and future rhythm plans.
- Task Pool primarily owns ad hoc one-off tasks.
- A rhythm template never moves into Pool.
- A generated rhythm instance retains template and occurrence identity.
- If held instances appear near Pool later, they require a separate group and must not become indistinguishable backlog rows.
- Plan may show eligible rhythm-instance suggestions only after the approved recurrence and day-profile behavior is separately implemented.
- Today may receive one occurrence after an explicit Add to Today once action or another separately approved path.
- Packs never create a Today task pile.

## 11. Identity and Migration Findings

Overlapping current and legacy concepts need stable identity decisions before catalogue migration:

- Open the first file versus First work focus block;
- Kitchen landing versus Kitchen reset;
- Doorway stretch versus Stretch / mobility;
- Gentle wind-down versus the broader legacy Shutdown evening pack.

Migration requirements:

- do not match templates by title alone;
- do not silently import or enable root legacy templates;
- preserve current custom template IDs;
- keep current active Today tasks as active tasks;
- do not infer recurrence from session-only enablement;
- do not turn contextual supports into rhythms automatically;
- do not copy the legacy `catchup` behavior;
- version built-in catalogue identities so content updates do not duplicate user plans;
- make pack membership updates separate from user-owned rhythm plans.

Backup implications are governed by `rhythm-recurrence-and-instance-contract.md`. Template, rhythm-plan, and rhythm-instance boundaries must remain explicit.

## 12. Testing Requirements for Future Catalogue Work

Future implementation must test:

- category-to-schema round trips without lossy Start Boost/Motivation or Admin/Household remapping;
- stable built-in and custom template identity;
- pack preview and individual deselection;
- no duplicate rhythm plans from overlapping packs;
- recurrence/profile review before activation;
- persistent enablement after reload;
- Add to Today once leaving recurrence unchanged;
- contextual supports not appearing as default recurring obligations;
- meal windows never creating food tasks;
- templates never moving into Pool;
- no automatic Today pile;
- no catch-up debt, streak, score, or pressure copy;
- local backup/version behavior for changed catalogue entries.

## 13. Explicit Non-goals

This audit does not approve or implement:

- catalogue, component, style, schema, or repository changes;
- persistent enablement;
- recurrence or instance generation;
- a new category taxonomy;
- pack execution changes;
- automatic Today insertion;
- mixed Pool/template/instance lists;
- financial, medical, nutrition, exercise, or treatment advice;
- importing the protected root catalogue;
- AI-generated catalogue entries;
- calendar writes, backend, sync, notifications, analytics, or restore/import execution.

## 14. Genuine Unresolved Decisions

- final taxonomy: activity domains versus contextual-support mechanisms;
- which current support-shaped entries leave Library for Start Boost or another contextual surface;
- whether Morning get ready and leave and after-work sensory decompression are profile-scoped rhythms or contextual/event checklists;
- whether Breakfast reset is removed, split, or rewritten as preparation distinct from meal context;
- exact new entries for Non-workday foundations, Admin cadence, and Monthly life admin;
- whether Low-capacity week is temporary configuration, persistent enablement, or a normal pack emphasizing minimum versions;
- whether onboarding may preselect built-in templates for explicit confirmation; migration itself must not enable them without validated persisted intent;
- canonical identity for overlapping current and legacy concepts;
- default recurrence, preferred profiles, and anchor dates for each curated template;
- whether flexible-quota preferred days are hints or constraints in each template;
- ownership when packs overlap or later change membership;
- deduplication behavior for repeated Add to Today once actions;
- how movement settings personalize templates without becoming recurrence definitions;
- the eventual presentation boundary between held rhythm instances and ad hoc Pool items.
