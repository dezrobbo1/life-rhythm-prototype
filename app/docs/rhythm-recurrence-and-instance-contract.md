# Rhythm Recurrence and Instance Contract

Status: Draft product contract for review; no implementation is authorized by this document

Scope: Future persistent rhythm enablement, recurrence rules, generated rhythm instances, planning modes, missed-occurrence handling, data separation, migration, backup, and testing for the `/app` architecture

## 1. Purpose

Life Rhythm needs a recurrence model that treats Library rhythms as reusable templates and each occurrence as a separate, calm, recoverable object.

This contract defines:

- what a Library rhythm is;
- what turning on a rhythm means;
- fixed-cadence and flexible-quota recurrence;
- stable generated rhythm instances;
- instance deduplication and completion boundaries;
- the distinction between recurring rhythms and ad hoc Task Pool items;
- future integration with Plan and Today;
- migration and backup requirements.

This is product-definition work only. It does not change schemas, repositories, Library actions, enablement, Today, Pool, Plan, backup formats, or the protected root 1.4.6 runtime.

## 2. Current and Future Boundaries

The current `/app` implementation remains unchanged:

- built-in Library rhythms are code-backed catalogue entries;
- user-created custom rhythm templates can be persisted locally;
- Library enable/disable and Quick Pack state are session-only preview behavior;
- current custom rhythm persistence does not persist the form’s enablement choice;
- `Add to Today now` creates one active Today task and does not persist recurrence;
- no rhythm-instance schema, repository, generator, or backup exists;
- current Pool suggestions operate on eligible held Pool items and explicit `openCapacity` blocks.

The existing schema fields `frequency`, `period`, `preferredDays`, `enabled`, and `catchupAllowed` are not a complete recurrence or instance model. This contract does not reinterpret them at runtime.

### Relationship to current Pool and scheduling contracts

Current runtime behavior remains governed by [`soft-scheduling-loop-contract.md`](soft-scheduling-loop-contract.md), [`soft-scheduling-protected-time-contract.md`](soft-scheduling-protected-time-contract.md), [`navigation-redesign-contract.md`](navigation-redesign-contract.md), and the current design spec.

If this draft is approved, its template/plan/instance separation replaces older future-facing language that treats rhythm instances as ordinary Task Pool items. That replacement becomes operative only with a separately approved schema, repository, migration, backup, and surface contract. It does not retroactively change current Pool ownership or authorize instance generation.

## 3. Locked Product Definitions

### Library rhythm template

A Library rhythm is a reusable recurring activity template.

Examples:

- gym three times per week;
- mobility four times per week;
- grocery list weekly;
- replace bedding fortnightly;
- review tomorrow on workdays;
- money review monthly.

A rhythm template is not:

- an ad hoc task;
- an occurrence;
- a Today task;
- a Pool item;
- completion history;
- a streak or adherence target.

### Enabled rhythm plan

Turning on a rhythm creates or updates persistent recurrence and planning intent for that template. It does not directly create a Today pile.

Within one local user namespace there is at most one durable rhythm plan for a template. Pause, disable, and re-enable update that stable plan rather than creating another plan. This invariant prevents overlapping packs from creating competing recurrence owners.

### Rhythm instance

A rhythm instance is one concrete occurrence generated from an enabled rhythm plan. Once recurrence implementation is separately approved and activated, every valid enabled plan generates deterministic instances within the bounded horizon; paused and disabled plans do not. Each instance retains stable links to its template and recurrence context.

Completing, skipping, holding, or removing one instance must not complete, disable, delete, or rewrite the template.

### Ad hoc Task Pool item

Task Pool is primarily for one-off tasks such as:

- book dentist;
- return parcel;
- call plumber;
- submit form;
- replace a broken item;
- research insurance.

A rhythm template never moves into Task Pool.

## 4. Proposed Object Model

The following objects and fields are conceptual. They are not schema changes in this task.

### 4.1 `RhythmTemplate`

Reusable content identity:

| Field | Meaning |
| --- | --- |
| `id` | Stable template identity. |
| `source` | Built-in or user-created. |
| `title` | User-facing rhythm name. |
| `area` / `taskType` | Explicit activity classification. |
| `purpose` | Plain-language reason the rhythm may help. |
| `minimum` / `normal` / `full` | Reusable versions. |
| `fallback` | Optional calm alternative. |
| `archivedAt` | Optional template retirement without deleting instance history. |

Template content does not own recurrence state, instance completion, Today state, or Pool state.

### 4.2 `RhythmPlan`

Persistent user intent for one template:

| Field | Meaning |
| --- | --- |
| `id` | Stable plan identity. |
| `rhythmTemplateId` | The template being turned on. |
| `state` | `enabled`, `paused`, or `disabled`; deletion is not a pause or disable action. |
| `recurrence` | Validated user-facing rule for the latest authored recurrence revision, including preferred days and applicable profiles where configured. |
| `effectiveFromLocalDate` | Prospective local date from which the initial enabled plan may generate occurrences. |
| `latestRecurrenceRevisionId` | Most recently authored recurrence revision, whether already active or future-dated; historical revisions remain traceable. |
| `bestTimePreference` | Broad timing preference, not a placement. |
| `planningMode` | `suggestWindow` or, only after separate approval, `placeSoftly`. |
| `missedOccurrencePolicy` | Calm handling choice. |
| `createdAt` / `updatedAt` | Persistence metadata. |
| `pausedAt` | Optional pause metadata. |

Separating `RhythmPlan` from template content allows the same catalogue template to remain stable while the user changes cadence or pauses future generation.

### 4.3 `RhythmRecurrenceRule`

Conceptual fields:

| Field | Meaning |
| --- | --- |
| `type` | `fixedCadence` or `flexibleQuota`. |
| `interval` | Positive interval count. |
| `unit` | `day`, `week`, or `month`. |
| `anchorDate` | Local calendar date used when interval calculation needs an origin. |
| `frequencyWithinPeriod` | Required for quota rules, such as three occurrences per week. |
| `weekdays` | Required fixed weekdays when the rule uses selected weekdays. |
| `preferredDays` | Hints for flexible quota; not automatically hard constraints. |
| `applicableProfileIds` | Profiles on which generation is allowed. |
| `localTimeZone` | Zone context used for local-date generation and audit. |

The final schema may normalize some fields into variants. It must preserve these meanings and reject contradictory combinations.

### 4.4 `RhythmRecurrenceRevision`

A recurrence revision gives activation and later edits an explicit prospective boundary.

| Field | Meaning |
| --- | --- |
| `id` | Stable revision identity. |
| `rhythmPlanId` | Plan whose recurrence is being activated or changed. |
| `revisionNumber` | Monotonic plan-local revision sequence. |
| `effectiveFromLocalDate` | Local date from which this revision governs generation. |
| `rule` | Validated recurrence-rule snapshot for this revision. |
| `createdAt` | Local persistence metadata. |

The initial revision uses the plan's `effectiveFromLocalDate`. Later edits create a new revision with an explicit future effective local date. For any target local date, generation uses the latest revision whose effective date is on or before that date. A future-dated revision does not rewrite the rule governing earlier dates. Earlier revisions remain available for occurrence identity, deduplication, and audit; they are not rewritten.

### 4.5 `RhythmInstance`

| Field | Meaning |
| --- | --- |
| `id` | Stable instance identity. |
| `rhythmTemplateId` | Stable source-template identity. |
| `rhythmPlanId` | The plan that generated the occurrence. |
| `occurrenceKey` | Stable logical occurrence identity within the rhythm plan. |
| `deduplicationKey` | Deterministic key preventing duplicate generation. |
| `recurrenceSnapshot` | Rule, revision, and effective-date context used when the instance was generated. |
| `occurrenceDate` or `eligibilityWindow` | Local date or bounded period in which this occurrence is useful. |
| `minimum` / `normal` / `full` | Inherited version snapshots for this occurrence. |
| `lifecycleState` | Current instance routing state. |
| `completionState` | Completion state separate from the template. |
| `planningState` | Occurrence-level suggestion or placement state; it does not own placement coordinates. |
| `activeTaskId` | Optional link to a separately persisted Today task projection. |
| `placementId` | Optional link to a separately persisted local soft placement. |
| `createdAt` / `updatedAt` | Persistence metadata. |

The template link must remain present even if an instance is shown in Today or near Pool later.

### 4.6 Ownership and cross-surface transitions

The generated `RhythmInstance` is the canonical owner of recurrence occurrence identity, inherited version snapshots, lifecycle, completion, and occurrence-level planning state.

Other data classes remain separate:

- an active Today task owns Today-specific task interaction state and references `sourceRhythmInstanceId` when it projects a generated instance;
- a soft placement owns its local date and window details and references the rhythm instance;
- a suggestion payload is an explainable read model derived from the instance and a candidate window, not a second occurrence owner;
- Library continues to own the template and rhythm plan;
- Pool continues to own ad hoc items.

A repository operation that routes a generated instance into Today or a placement must update the instance link/state and create or update the projection atomically. Removing a projection clears that route without deleting the instance or template. A live Today projection and a live soft placement may coexist only when the user separately authorizes each; neither action creates the other. One instance must not acquire duplicate live Today projections or duplicate live soft placements.

## 5. Primary and Secondary Library Actions

The primary conceptual Library action becomes:

> Turn on rhythm

Turning on a rhythm must eventually persist:

- enabled, paused, or disabled state;
- recurrence rule;
- preferred days or day profiles;
- timing preference;
- minimum, normal, and full versions through the template link and instance snapshot;
- missed-occurrence policy;
- planning mode.

The secondary override may remain:

> Add to Today once

`Add to Today once` is an explicit secondary action. It does not require a `RhythmPlan` and may be used when the template has no plan, a disabled plan, a paused plan, or an enabled plan. It:

- creates or surfaces one occurrence for Today after explicit user action;
- retains the template identity;
- never turns the rhythm on or off;
- never edits recurrence;
- never creates future occurrences by itself;
- never creates a Pool item;
- never creates a calendar event;
- never fabricates a `rhythmPlanId` merely to support the manual action.

When no enabled plan or matching generated occurrence applies, the action may create one template-linked manual Today task. That task is not automatically a generated `RhythmInstance` and must retain explicit manual one-occurrence identity. Any collision context needed for later deduplication must be represented without fabricating a `rhythmPlanId` on the manual task or overloading generated-instance identity.

When an enabled plan exists:

- the implementation must check for an existing or prospectively matching generated occurrence for the same logical rhythm occurrence;
- it must not silently create both a manual Today task and a generated instance for that logical occurrence;
- it must either reuse or surface the matching instance, or obtain an explicit user choice under a separately approved collision rule;
- a manual override must not silently consume a recurrence quota slot unless an approved matching or reuse rule explicitly does so;
- the collision outcome must remain durable enough that later background generation does not create a duplicate after the manual Today action.

Repeated use must follow the same collision rule and must not silently create a duplicate logical occurrence. The exact reuse, linking, or explicit-choice behavior remains unresolved implementation work; it must not alter enablement or recurrence.

## 6. Supported Recurrence Forms

The recurrence model must support:

- every day;
- selected weekdays;
- every N days;
- every week;
- N times per week;
- every two weeks / fortnightly;
- every N weeks;
- every month;
- every N months;
- preferred days;
- applicable day profiles;
- an anchor date where interval calculation requires one.

### Fixed cadence

Fixed cadence represents a specific recurring position in time.

Example:

> Replace bedding every second Saturday.

This is not a weekly frequency of `0.5`. It is an interval of two weeks, anchored to a known local date, with Saturday as the occurrence day.

### Flexible quota

Flexible quota represents a number of useful occurrences within a period.

Example:

> Gym three times during each week, preferably Monday, Wednesday, and Saturday.

Preferred days guide suggestions. They do not create failure if a different suitable day is chosen or an occurrence is skipped.

## 7. Recurrence Examples

| User meaning | Type | Conceptual rule |
| --- | --- | --- |
| Every day | Fixed cadence | interval 1, unit day, anchored local date |
| Monday, Wednesday, Friday | Fixed cadence | interval 1, unit week, weekdays Mon/Wed/Fri |
| Every three days | Fixed cadence | interval 3, unit day, required anchor date |
| Every Saturday | Fixed cadence | interval 1, unit week, Saturday |
| Three times per week | Flexible quota | frequency 3, unit week, interval 1, optional preferred days |
| Every second Saturday | Fixed cadence | interval 2, unit week, Saturday, required anchor date |
| Every four weeks | Fixed cadence | interval 4, unit week, required anchor date |
| Monthly | Fixed cadence | interval 1, unit month, anchored monthly rule |
| Every three months | Fixed cadence | interval 3, unit month, anchored monthly rule |
| Twice per month | Flexible quota | frequency 2, unit month, interval 1, bounded monthly period |

Daily, weekly, and monthly are recurrence units, not labels that can approximate every requested cadence. Fortnightly recurrence must remain an anchored two-week interval.

## 8. Generation and Deduplication

Once the recurrence model is separately approved and activated, an enabled rhythm plan generates instances within a bounded generation horizon.

Generation rules:

- generation is local-first and deterministic for the same validated inputs;
- no instance is generated before the plan or governing revision's `effectiveFromLocalDate`;
- current and historical periods are never backfilled automatically;
- one logical occurrence produces at most one instance record;
- generation must honor durable manual one-occurrence collision outcomes so that a later run does not create another representation of the same logical occurrence; a manual action may reserve a quota slot only under an approved matching or reuse rule;
- fixed cadence uses a canonical local occurrence date or anchored interval position;
- flexible quota uses stable numbered slots inside a canonical period, such as `2026-W33#1`;
- quota slot numbers are deduplication identities only; they do not imply priority, order, debt, or an obligation to complete every slot;
- slot allocation is deterministic for the same plan revision and canonical period;
- slot keys already generated in a period remain reserved across revisions; a later revision may use only unclaimed prospective slots without duplicating an occurrence;
- when a flexible quota is enabled partway through its first period, only prospective, feasible remaining slots may be generated; the whole quota must not appear as an immediate obligation;
- an unfilled partial-period quota does not carry into the next period, and the next complete period begins with its normal configured quota;
- `deduplicationKey` is based on stable rhythm-plan identity plus canonical occurrence identity, while the separate template link remains intact;
- recurrence revision is stored for traceability, but a revision change must not create a duplicate of an already generated logical occurrence;
- retries, reloads, timezone recalculation, and app restarts must not duplicate an instance;
- an instance that has been completed, skipped, or closed is still evidence that the occurrence was generated;
- disabling and re-enabling must not regenerate closed occurrences inside the same key;
- deleting and recreating a plan must not resurrect historical occurrences unless a separately approved future policy explicitly defines safe lineage and identity behavior.

Exact generation horizon and cleanup policy require approval before implementation. The horizon must be small enough to avoid a future-occurrence pile.

## 9. Instance and Completion State

Instance routing and completion must remain separate.

Conceptual `lifecycleState` values may include:

- eligible;
- today;
- held;
- skipped;
- closed.

Conceptual `planningState` values may include:

- unsuggested;
- suggested;
- rejected;
- softlyPlaced.

Conceptual `completionState` values may include:

- notStarted;
- minimumDone;
- done.

Requirements:

- completing an instance does not complete or delete the template;
- completing the minimum closes only the amount the user chose for that instance;
- pausing a rhythm stops future generation but does not erase completed instances;
- disabling a rhythm stops future generation according to an approved cutoff rule;
- editing a template does not rewrite historical version snapshots;
- editing recurrence creates a prospective revision with an explicit `effectiveFromLocalDate`;
- completed and closed instances retain their original recurrence revision and snapshot;
- recurrence edits must not duplicate already generated logical occurrences;
- instance state must never become a template-level streak or adherence score.

## 10. Missed-Occurrence Policy

Calm per-rhythm options may include:

- skip this occurrence;
- find the next suitable window;
- ask me;
- keep only the minimum version if it is still useful;
- pause the rhythm.

Missed-occurrence handling must not create:

- overdue debt;
- automatic catch-up piles;
- red failure states;
- streak loss;
- completion scoring;
- compulsory rescheduling;
- a larger future quota because an earlier occurrence was skipped.

A flexible weekly quota may use remaining room in the current period only while it is still useful and within the original quota. It must not roll unmet occurrences into the next period.

## 11. Planning Modes

### 11.1 Suggest a window — intended default

- The app proposes a suitable window.
- The user may confirm, change, reject, or ignore it.
- A suggestion remains separate from persisted placement state.
- Current candidate-window and placement boundaries remain in force until the day-profile contract is implemented.

### 11.2 Place softly — future explicit per-rhythm opt-in

- May create a reversible local soft placement under a separately approved write path.
- Must be easy to remove, reject, or move.
- Must never create an external calendar event.
- Must preserve instance identity and explain why the placement exists.

`Place softly` would change the current user-confirmed-write boundary because the current app writes a placement only after an immediate confirmation. It requires separate product approval, schema/repository review, migration/backup design, and tests before implementation.

Neither planning mode is implemented by this document.

A soft placement remains optional and separate from Today. Confirming a suggestion creates only the approved local placement and never routes the instance into Today. Add to Today remains a separate explicit user action that may occur with or without a soft placement.

## 12. Relationship to Day Profiles and Plan

An instance may be eligible only when its rhythm plan matches the selected local date and, where configured, the date’s assigned day profile.

Future Plan integration must preserve:

- candidate windows are not placements;
- blank time is not automatically available;
- work-related instances are explicitly classified before `Work rhythms only` can admit them;
- profile-derived windows remain possibilities rather than commitments;
- suggestions are capped and explainable;
- current user-confirmed placement remains unchanged unless a later contract explicitly approves another write path.

## 13. Task Pool Boundary

Task Pool remains primarily an ad hoc one-off holding tray.

Rules:

- a rhythm template never becomes a Pool item;
- a rhythm plan never becomes a Pool item;
- a generated rhythm instance always retains `rhythmTemplateId`, `rhythmPlanId`, and occurrence identity;
- an instance must not be flattened into an indistinguishable ad hoc Pool row;
- if deferred or held instances are displayed near Pool later, they must use a visibly and semantically separate group;
- Pool counts, backlog language, debt framing, and mixed template/instance/task queues remain forbidden.

The current `TaskPoolItem` schema’s optional template and instance references do not authorize mixed Pool behavior before a separate implementation contract.

## 14. Packs

A pack is a curated collection of recurring rhythm templates.

A future pack flow must:

- preview included rhythms;
- allow individual deselection;
- show or allow editing of recurrence and applicable profiles;
- turn on only the selected rhythms;
- persist each selected rhythm plan;
- handle overlapping pack membership without duplicate plans or instances;
- never dump all included rhythms directly into Today.

Packs are activation helpers, not separate recurrence engines. Removing a pack later must not silently disable individually configured rhythms without an approved ownership rule.

## 15. Editing, Pausing, and Disabling

Future behavior must distinguish:

- editing reusable template content;
- editing a rhythm plan’s recurrence;
- pausing future generation;
- disabling a plan;
- closing one instance;
- archiving a template.

Minimum requirements:

- pause and disable do not erase completed history;
- an existing Today task or placement is not silently deleted by pause/disable;
- recurrence changes have an explicit visible future effective local date;
- no recurrence edit generates occurrences before that effective date or backfills an earlier period;
- completed and closed instances retain the recurrence snapshot under which they were generated;
- already generated logical occurrences are not silently duplicated or rewritten across revisions;
- the treatment of untouched future instances on or after the effective date must follow a separately approved transition policy;
- template archive is blocked or clearly explained while active plans still reference it;
- no action creates catch-up debt.

## 16. Migration Requirements

Migration must be separately approved and tested.

### Current `/app` templates

- Preserve stable template IDs and content.
- Do not treat session-only enablement as durable user intent.
- Existing built-in and custom templates should remain off unless there is validated persisted enablement from an approved source.
- Preserve existing active Today tasks created from Library; do not retroactively turn them into recurring instances without an explicit identity rule.

### Existing schedule hints

- `frequency` plus `period` may be proposed as a flexible-quota rule only when the combination is valid and user-reviewable.
- `preferredDays` may be preserved as preferences, not silently upgraded to hard cadence.
- interval recurrence requires a new anchor date and must not be invented from `updatedAt`.
- any migrated plan requires an explicitly reviewed prospective `effectiveFromLocalDate`; migration must not infer a historical activation date or backfill earlier periods.
- a migrated flexible quota that begins partway through a period follows the partial-first-period rules and creates no catch-up obligation.
- existing `catchupAllowed` must not migrate into catch-up debt; the safe migrated policy is no automatic catch-up.
- incomplete or contradictory hints keep the template off and require review.

### Protected root legacy data

The root 1.4.6 runtime is historical evidence only. Its enabled templates, packs, completion keys, and scheduler behavior must not be automatically imported or copied into `/app` by this contract.

## 17. Persistence and Backup Requirements

Future persistence must keep separate validated data classes for:

1. rhythm template content;
2. rhythm plans and recurrence configuration;
3. rhythm instances;
4. active Today tasks;
5. ad hoc Pool items;
6. soft placements.

Any manual Today task created through `Add to Today once` must preserve its explicit manual one-occurrence identity and any separately approved collision or reuse link needed for deduplication. Backup and validation rules must preserve and check that identity without fabricating a rhythm-plan link.

Backup design must define:

- a versioned template format when recurrence-related template fields change;
- a rhythm-plan backup containing enablement, recurrence, planning mode, and missed policy;
- a rhythm-instance backup containing occurrence identity, snapshots, states, and deduplication keys;
- whether completed instance history is exported separately from current/live instances;
- duplicate-ID and duplicate-occurrence rejection;
- referential validation across template, plan, instance, Today, and placement IDs;
- safe behavior when one data class is missing;
- local namespace boundaries;
- read-only validation before restore/import execution is considered.

Task Pool backup must not absorb rhythm templates or rhythm plans. If future held instances are included in a backup, their class and identity must remain explicit rather than masquerading as ad hoc Pool tasks.

Each data-class export remains a separate artifact. At export time, the app must validate cross-class references against the local repositories and include a non-content dependency summary of referenced IDs and format versions. A standalone read-only checker can verify format, internal uniqueness, and reference shape, but must report external references as unverified when their companion class is not supplied; it must not call such an artifact fully restorable. A future coordinated restore would need explicit dependency ordering and transactional policy before it could materialize any referenced record.

This contract does not approve restore/import execution or a combined whole-app backup.

## 18. Timezone and Calendar-Date Rules

Recurrence must use local calendar dates, not UTC-midnight assumptions.

Future implementation must:

- store or deterministically resolve the local timezone used for generation;
- keep anchor dates as validated local dates;
- interpret plan and recurrence-revision effective dates as local calendar dates in the plan's resolved timezone;
- define week boundaries explicitly;
- define how monthly rules behave when a target day does not exist;
- avoid duplicate generation across daylight-saving changes;
- distinguish a timezone change from a new occurrence;
- make travel/timezone behavior reviewable rather than silently rebuilding history.

No external calendar read or write is approved.

## 19. Testing Requirements for Future Implementation

Tests must cover:

- every day and selected-weekday cadence;
- every N days;
- weekly and N-times-per-week rules;
- fortnightly rules with anchor dates;
- every N weeks;
- monthly and every N months;
- flexible-quota preferred days;
- applicable day profiles;
- stable instance and deduplication keys;
- idempotent generation across reload and retry;
- enabling on the final day of a weekly period without generating a full immediate quota;
- enabling halfway through a monthly period with only prospective feasible remaining slots;
- no retroactive generation before `effectiveFromLocalDate`;
- no first-period catch-up pressure or quota carry-over;
- recurrence editing with an explicit future effective local date;
- no duplicate logical occurrences across plan revisions;
- deterministic flexible-quota slot identities for the same revision and period;
- pause, disable, re-enable, and archive boundaries;
- completion state separate from template state;
- no future generation while paused or disabled;
- no catch-up debt after skipped or missed occurrences;
- Add to Today once with no `RhythmPlan`;
- Add to Today once with a disabled plan;
- Add to Today once with a paused plan;
- Add to Today once with an enabled plan and no matching instance;
- Add to Today once with an enabled plan and an existing matching instance;
- generator execution after a manual same-date occurrence;
- repeated Add to Today once actions;
- recurrence and enablement remaining unchanged after Add to Today once;
- no duplicate logical occurrence after Add to Today once;
- templates never moving into Pool;
- held instances retaining template and occurrence identity;
- pack overlap and individual deselection;
- local-date behavior under UTC and Australia/Perth test environments;
- at least one daylight-saving timezone;
- month-length and leap-year cases;
- backup versioning and referential validation;
- no calendar, AI, backend, sync, notification, analytics, or restore writes.

## 20. Explicit Non-goals

This contract does not approve or implement:

- schemas, repositories, migrations, or generation jobs;
- persistent enablement or recurrence in the current UI;
- automatic Today insertion;
- automatic catch-up or quota carry-over;
- scheduler-owned placement;
- `Place softly` writes;
- calendar reads or writes;
- AI scheduling or AI-written state;
- backend storage or cloud sync;
- notifications or analytics;
- streaks, scores, adherence, or completion pressure;
- import/restore execution;
- mixed template/instance/ad hoc Pool backlogs;
- copying the protected root runtime into `/app`.

## 21. Decisions Still Requiring Approval

The following decisions must be resolved before their affected implementation:

- the bounded generation horizon and cleanup policy;
- week start and weekly-period identity;
- monthly rules for the 29th, 30th, or 31st when a month is shorter;
- timezone-change and travel behavior for future instances;
- the default user-facing choice of prospective effective date when turning on or editing a rhythm;
- whether already generated but untouched instances follow an edited rule;
- the exact feasible-slot allocation policy for a partial first quota period;
- how pause differs from disable in user-facing copy and generation cutoff;
- the exact reuse, linking, or explicit-choice behavior when `Add to Today once` collides with an existing or prospectively matching generated occurrence;
- the lineage or tombstone policy that prevents deletion and later recreation of a rhythm plan from resurrecting historical occurrences;
- the first set of lifecycle and completion enum values;
- retention and backup scope for completed instances;
- the artifact-set and dependency policy for validating or eventually restoring cross-class references;
- the exact separate surface for deferred or held rhythm instances;
- whether and when `Place softly` receives separate approval;
- ownership behavior when a pack is removed or its membership changes;
- how built-in catalogue updates preserve customized recurrence plans.
