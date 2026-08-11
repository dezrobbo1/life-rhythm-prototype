# Day Profile and Availability Contract

Status: Draft product contract for review; no implementation is authorized by this document

Scope: Future Workday and Non-workday profiles, profile-specific day context, derived planning boundaries, candidate-window calculation, migration, backup, and testing requirements for the `/app` architecture

## 1. Purpose

Life Rhythm needs a day model that can protect real life without requiring the user to mark every usable interval as `openCapacity`.

This contract defines the product boundary for:

- Workday and Non-workday profiles;
- weekday-to-profile assignment;
- optional profile-specific meal, wake, sleep, commute, commitment, and transition context;
- work hours as a derived planning boundary;
- candidate windows derived primarily by subtracting unavailable and leave-alone time from a usable-day envelope;
- safe migration from the current global Life Shape fields.

This is product-definition work only. It does not change settings, schemas, persistence, suggestions, placements, Today, Pool, Library, backup formats, or the protected root 1.4.6 runtime.

## 2. Current and Future Boundaries

The current `/app` implementation remains unchanged:

- Life Shape has one global work-hours pattern, global meal anchors, global wake/sleep anchors, fixed-commitment context, transition settings, and explicit time blocks.
- Current soft suggestions and user-confirmed placements use only explicit `openCapacity` blocks.
- Blank time is not treated as available.
- Suggestions do not create placements.
- Placements require explicit user confirmation and remain local.

The future model defined here must not be activated by a schema migration alone. Profile-backed candidate-window derivation requires a separately reviewed implementation and an explicit migration/readiness gate.

### Relationship to current scheduling contracts

[`soft-scheduling-protected-time-contract.md`](soft-scheduling-protected-time-contract.md) remains authoritative for current runtime behavior: blank and loose time are not available, and explicit `openCapacity` is the only addable suggestion source.

If this draft is approved, it will replace that contract's future assumption that every possible planning interval must first be explicitly opened, but only after the profile schema, migration review gate, typed boundary calculation, backup changes, and user-facing controls are separately approved and implemented. Until activation, this document does not broaden availability or supersede current behavior.

## 3. Product Definitions

### Day profile

A day profile is a reusable description of the broad shape and boundaries of a kind of day.

It is not:

- a detailed calendar;
- an hourly timetable;
- proof of energy or willingness;
- a productivity target;
- a promise that every remaining gap can be used.

### Usable-day envelope

The usable-day envelope is the broad local-time range inside which Life Rhythm may consider planning context.

Time outside the envelope is unavailable by definition. The envelope is not itself open capacity.

Profile-derived candidate windows require a valid, reviewed usable-day envelope and an activated profile-derivation state. If the envelope is absent, invalid, or not activated, Life Rhythm emits no inferred candidate windows for that profile. Current explicit `openCapacity` blocks remain usable through the existing approved path.

The app must not substitute all-day availability, assumed waking hours, device activity, or calendar gaps for a missing envelope. A profile may therefore remain partially configured without widening availability.

### Derived planning boundary

A derived planning boundary is a restriction produced from saved profile context, such as work hours plus commute and transition buffers. The user should not need to duplicate the same work period as a manual protected-time block.

### Candidate window

A candidate window is a remaining interval that may be considered for a suggestion after boundaries have been applied. It is only a possibility.

A candidate window is not:

- a placement;
- an external calendar event;
- an instruction;
- evidence that the user has energy or attention available;
- a gap the app is expected to fill.

## 4. Conceptual Object Model

The following fields are conceptual. They are not additions to `app/src/data/schemas.ts` in this documentation task.

### `DayProfile`

| Field | Meaning |
| --- | --- |
| `id` | Stable profile identity. |
| `name` | User-facing name, initially Workday or Non-workday. |
| `kind` | `workday`, `nonWorkday`, or a later `custom` kind. |
| `usableDay` | Optional local start and end for the broad usable-day envelope. |
| `workPeriods` | Zero or more work periods with a planning-use selection. The first implementation may deliberately support one period. |
| `commuteContext` | Optional before-work and after-work travel context. |
| `travelContext` | Optional non-work travel context; explicit commitment-specific travel remains attached to that commitment. |
| `fixedCommitments` | Profile-level commitments with local times where known. Notes without times remain context only. |
| `unavailablePeriods` | Time that must not be considered for suggestions. |
| `leaveAlonePeriods` | Protected, recovery, family, or other user-protected time. |
| `transitionBuffers` | Time needed before or after work, travel, or commitments. |
| `mealWindows` | Optional breakfast, lunch, dinner, or user-named meal context. |
| `sleepWakeContext` | Optional wake, wind-down, and sleep context. |
| `lowCapacityPreference` | A calm ranking or filtering preference, never an inferred diagnosis or capacity score. |
| `createdAt` / `updatedAt` | Local persistence metadata when implementation is approved. |

### `WeekdayProfileAssignment`

| Field | Meaning |
| --- | --- |
| `weekday` | Monday through Sunday. |
| `profileId` | The profile normally used for that weekday. |

Every weekday must resolve to one profile. The initial safe default is:

- existing saved workdays → Workday;
- all other weekdays → Non-workday.

### Future `DateProfileOverride`

A later contract may allow a local date to use a different profile or narrow selected context for that date. It must not silently edit the reusable profile.

Per-date overrides are required eventually for leave, travel, public holidays, unusual shifts, illness, care responsibilities, or recovery days. Their exact storage and expiry rules remain a future decision.

### `PlanningWindowAssessment`

Candidate derivation must produce a typed, explainable result rather than a bare time interval.

| Field | Meaning |
| --- | --- |
| `localDate` | Local calendar date being assessed. |
| `startLocal` / `endLocal` | Bounded local-time interval. |
| `profileId` | Profile used for the calculation. |
| `accessMode` | `possible` or `askFirst`. Unavailable intervals are not emitted as candidates. |
| `reasonCodes` | Stable reasons that produced or restricted the interval, including work, meal, transition, protected-time, or explicit-open context. |
| `positiveContext` | Optional explicit `openCapacity` or later approved positive signal; it cannot override a higher-precedence restriction. |

An `askFirst` assessment must remain distinct through eligibility, presentation, and the user's decision. It must never be downgraded to an ordinary possible window. A possible assessment still does not prove energy, willingness, or capacity.

### `DayProfileMigrationState`

Migration-only context must have an explicit owner separate from a normalized profile.

| Field | Meaning |
| --- | --- |
| `sourceSettingsVersion` | Settings version from which profile review began. |
| `reviewState` | `notStarted`, `needsReview`, or `reviewedAndEnabled`. |
| `legacyMealAnchors` | Preserved point anchors that have not been converted to meal windows. |
| `legacySleepWakeAnchors` | Preserved wake/sleep context not yet activated as a usable-day envelope. |
| `legacyCommuteTransitionContext` | Preserved ambiguous values awaiting directional review. |
| `legacyTravelContext` | Preserved global non-work travel value that has not been assigned to a profile or commitment. |
| `legacyLowCapacityPreference` | Preserved global preference awaiting explicit profile review. |
| `reviewedAt` | Optional local persistence metadata for the activation gate. |

This state is compatibility metadata, not a second permanent profile model. It may be removed only after a separately reviewed migration proves that no required legacy context would be lost.

## 5. Required Profiles and Extensibility

The first approved implementation must support at least:

1. Workday
2. Non-workday

The model may later support user-created profiles such as:

- office day;
- work-from-home day;
- shift day;
- school-run day;
- recovery day;
- custom day.

Additional profiles must reuse the same boundary rules. They must not introduce a parallel scheduler model.

Profile names are descriptive context, not scores, diagnoses, or expectations about performance.

## 6. Meal Context

Meal context is optional and profile-specific.

A meal entry may be:

- a bounded window;
- flexible within a broader window;
- omitted for that profile.

Example:

| Profile | Breakfast | Lunch | Dinner |
| --- | --- | --- | --- |
| Workday | 06:30–07:30 | 12:00–13:00 | 18:00–19:00 |
| Non-workday | flexible 08:00–10:00 | omitted | 18:30–20:00 |

Meal context normally protects time as either:

- unavailable; or
- ask first.

The protection choice must be explicit and visible in settings. A meal window does not create a food task, mark a meal complete, or monitor eating.

Meal context must remain separate from reusable food rhythms such as:

- Plan dinner;
- Pack lunch;
- Grocery list;
- Restock emergency meals.

Life Rhythm must not provide nutrition, dieting, calorie, weight, eating-compliance, or medical advice.

## 7. Sleep, Wake, and the Usable Day

Wake and sleep context is optional and profile-specific.

The primary planning object is the usable-day envelope. Sleep context may help a user set that envelope, but it must not become:

- a sleep-performance target;
- a compliance measure;
- a sleep score;
- medical or treatment advice.

When no usable-day envelope is configured, Life Rhythm must not infer one from device activity, calendar gaps, or assumed waking hours.

Overnight and shift-day envelopes require explicit local-date rules before implementation. They must not be approximated by swapping invalid start and end values.

## 8. Work Hours and Planning Use

Saved work hours automatically form a derived planning boundary. The user must not need to enter work hours and then duplicate them as a protected-time block.

The profile-level question is:

> How should Life Rhythm use work hours?

### 8.1 Work rhythms only — recommended default

- Allow only eligible generated instances of work-related rhythms.
- Exclude household, personal administration, exercise, and unrelated ad hoc Pool tasks.
- A work rhythm must retain its Library template and occurrence identity.
- Work classification must be explicit; title keywords alone are not sufficient.

### 8.2 Completely unavailable

- Remove work hours from candidate-window calculation.
- Do not show suggestions inside the work period.

### 8.3 Ask before suggesting

- A possible work-hour fit may be shown only with a clear ask-first decision.
- No placement is created unless the user accepts through an approved path.
- Repeated asking must be limited so the mode does not become pressure.

### 8.4 Allow suitable tasks

- Eligible tasks or rhythm instances may be considered inside work hours.
- All other boundaries, usefulness windows, duration checks, and user-confirmation requirements still apply.
- This option does not make every work gap available.

### 8.5 Commute and transition extension

The derived work boundary has three segments:

1. inbound commute and pre-work transition;
2. the core work period;
3. post-work transition and outbound commute.

Commute and transition segments extend the boundary outward from the core work period. They are unavailable by default and do not inherit `Work rhythms only` or `Allow suitable tasks` permission.

A later explicit override may narrow or open those segments, but the default must protect travel and context switching. A single legacy commute duration is not sufficient to infer distinct before-work and after-work values without user review.

## 9. Candidate-Window Derivation

The calculation below runs only for a valid, reviewed usable-day envelope after profile derivation is activated. An absent, invalid, or inactive envelope produces no inferred candidate windows; it does not trigger an all-day or assumed-hours fallback. Current explicit `openCapacity` remains governed by the compatibility rule in Section 10.

The future conceptual calculation is:

```text
usable-day envelope
minus unavailable periods
minus protected or leave-alone periods
minus fixed commitments
minus meal windows according to their protection mode
minus restricted work segments
minus commute, travel, and transition buffers
```

The remaining intervals are candidate windows only.

### Access-mode propagation

Boundary evaluation has three outcomes:

1. `unavailable` — remove the interval; it cannot become a suggestion.
2. `askFirst` — retain a typed `askFirst` assessment and require the explicit decision defined by the relevant meal or work rule.
3. `possible` — retain an ordinary assessment, still subject to eligibility, ranking, caps, rejection, and user-confirmed placement.

An overlap with a stricter outcome uses that stricter outcome. `askFirst` therefore never becomes an ordinary candidate merely because other parts of the same interval remain inside the usable-day envelope.

### Boundary precedence

When contexts overlap, the safest meaning wins:

1. outside the usable-day envelope;
2. explicit date-specific unavailable or leave-alone override;
3. fixed commitment, commute, or transition boundary;
4. profile-level unavailable or protected period;
5. meal protection;
6. work-hours planning-use rule;
7. explicit `openCapacity` or other positive planning context;
8. otherwise remaining possible time.

An explicit positive signal must not silently override a higher-precedence unavailable boundary. Conflicts must be shown for user resolution or treated as unavailable.

Ordinary `openCapacity` does not override the work-hours planning-use rule above it. A future separately confirmed exception would require an explicit policy for the work modes that permit it, and it must never override a completely unavailable work period, commute or transition protection, fixed commitments, date-specific unavailable time, or another higher-precedence unavailable boundary.

### Candidate filtering

Even after subtraction, the app must be allowed to leave a window unused because it is:

- too short for the minimum version plus buffers;
- outside the task’s usefulness window;
- a poor time-of-day or profile fit;
- already represented by another accepted placement;
- one of too many suggestions;
- rejected or narrowed by the user;
- otherwise unsuitable under an approved eligibility rule.

Life Rhythm must not try to consume every remaining interval.

## 10. Relationship to Current `openCapacity`

Until a profile implementation is separately approved and released:

- current suggestions continue to use explicit `openCapacity` only;
- current `askFirst` and unavailable behavior remains unchanged;
- no existing blank time becomes a candidate window;
- an absent, invalid, or inactive usable-day envelope emits no inferred candidates but does not disable the existing explicit-`openCapacity` path;
- no placement or Today movement occurs automatically.

In the future profile model, explicit `openCapacity` can remain a strong positive signal or a user-defined narrowing of candidate space only inside a valid activated planning context. It must not be required for every usable interval, create an inferred envelope, or override a conflicting unavailable or work-rule boundary without a separately approved explicit user decision.

## 11. Example Profiles

### Workday example

- usable day: 06:30–22:30;
- core work: 08:30–17:00;
- work use: Work rhythms only;
- inbound commute: 30 minutes;
- pre-work transition: 10 minutes;
- outbound commute: 30 minutes;
- post-work transition: 20 minutes;
- lunch: 12:00–13:00, unavailable;
- dinner: 18:30–19:30, ask first;
- low-capacity preference: protect evening.

This profile does not make 06:30–08:00 or 19:30–22:30 automatically available. Those ranges are only inputs to candidate derivation after every other boundary is applied.

### Non-workday example

- usable day: 08:00–23:00;
- no work period;
- breakfast: flexible 08:00–10:00, ask first;
- lunch: omitted;
- dinner: 18:30–20:00, unavailable;
- one fixed commitment with travel buffer;
- one protected recovery period.

Omitting lunch context means “no saved planning boundary for lunch,” not “lunch time is free.”

## 12. Suggestions and Write Boundaries

Profile calculation may eventually produce read-only candidate windows.

It must not by itself:

- create or update a task;
- create a rhythm instance;
- add anything to Today;
- create a soft placement;
- move an existing placement;
- write an external calendar event;
- change a profile or date assignment;
- infer energy, willingness, ADHD severity, or productivity.

The current rule remains:

> Life Rhythm suggests. The user decides.

Any future `Place softly` rhythm mode is governed by the separate rhythm recurrence and instance contract and requires explicit approval because it would change the current user-confirmed-write boundary.

## 13. Migration Requirements

Migration must be local, validated, reversible at the data-version level, and separately implemented.

### Initial profile creation

- Create one Workday profile from the validated current work-hours fields.
- Create one Non-workday profile without a work period.
- Assign current saved workdays to Workday.
- Assign remaining weekdays to Non-workday.
- Preserve current explicit Life Shape time blocks and their scheduler-use meaning as existing settings-owned overlays during migration.
- Preserve all current fixed commitments, including valid day/time/travel/buffer fields, as settings-owned overlays during migration.
- Preserve the current global low-capacity preference as settings-owned context pending profile review.
- Do not infer timed commitments from free-text notes.

Existing Life Shape blocks are not copied into every profile or silently transformed into profile fields. During compatibility they continue to apply alongside the assigned profile under the boundary-precedence rules. Moving a block into reusable profile ownership requires an explicit user choice or a later approved conversion rule.

Current timed commitments continue to apply with their saved days, start/end times, travel, and buffer values; they are not copied into every profile. Current notes-only commitment context also remains settings-owned and must not populate timed `DayProfile.fixedCommitments` until the user supplies or confirms valid local times. Moving either form into reusable profile ownership requires explicit review.

The current global low-capacity preference remains settings-owned until the user chooses whether and how it applies to Workday, Non-workday, or both. Migration must not silently duplicate it across profiles.

### Global meal anchors

Current breakfast, lunch, and dinner values are points, not bounded windows. Migration must preserve them as reviewable legacy anchors; it must not invent blocking durations.

A user may later turn an anchor into a profile-specific window, mark it flexible, or omit it. Until reviewed, a migrated anchor must not subtract new time from candidate calculation.

### Global wake and sleep anchors

Preserve current wake and sleep values as reviewable context for both initial profiles. Do not silently activate them as usable-day boundaries.

### Commute, travel, and transition

Preserve the existing commute, general travel, and transition values separately and label their ambiguity. Do not reinterpret global travel as work commute, infer separate inbound and outbound durations, or activate derived work boundaries until the user has reviewed the migrated profile.

### Activation gate

A migration must persist `DayProfileMigrationState.reviewState`. Profile derivation activates only when the state is `reviewedAndEnabled` and the assigned profile has a valid reviewed usable-day envelope. Migration may remain partially configured without widening availability. Before that gate, or while the envelope is absent or invalid:

- existing settings remain usable;
- current explicit `openCapacity` behavior remains authoritative;
- no newly derived candidate windows appear.

Conflicts between duplicated legacy settings fields must be surfaced in validation rather than silently resolved.

## 14. Persistence and Backup Requirements

A future implementation must define and test:

- stable profile IDs;
- weekday assignment persistence;
- optional profile-specific contexts;
- migration-state ownership for unconverted legacy anchors and the derivation review gate;
- local-date override identity and expiry if overrides are added;
- settings schema versioning;
- migration provenance and review state;
- deterministic validation defaults;
- account-local namespace behavior;
- separate handling of invalid stored profiles.

Settings backup changes must:

- increment or explicitly version the settings backup format;
- include profiles and weekday assignments only after their write path is approved;
- preserve migrated legacy-anchor context while needed;
- identify whether derived availability has been reviewed and enabled;
- remain local and user-triggered;
- update read-only backup checking before any restore execution is considered;
- reject rhythm templates, rhythm instances, Pool items, Today tasks, placements, scheduler output, calendar data, and unrelated data classes.

This contract does not approve restore/import execution.

## 15. Testing Requirements for Future Implementation

Tests must cover:

- Workday and Non-workday creation and weekday assignment;
- all seven weekdays resolving to one valid profile;
- optional and omitted meal context;
- profile-specific meal and sleep differences;
- usable-day boundaries excluding outside time;
- absent, invalid, and not-yet-activated usable-day envelopes producing no inferred candidate windows;
- no fallback to all-day availability, assumed waking hours, device activity, or calendar gaps;
- work-hours behavior for all four planning-use options;
- commute and transition extension around work;
- higher-precedence unavailable boundaries winning conflicts;
- no candidate from short or unsuitable fragments;
- explicit `openCapacity` remaining compatible during migration;
- explicit `openCapacity` remaining usable when profile derivation is incomplete or inactive;
- no automatic Today movement, placement, calendar write, or task mutation;
- safe migration from global work, meal, wake, sleep, commute, and transition fields;
- preservation and review of global travel, timed commitments, notes-only commitments, and low-capacity preference;
- conflicting legacy values producing a reviewable result;
- settings backup version and read-only validation;
- local-date calculations in UTC and Australia/Perth test environments;
- daylight-saving transitions in at least one DST-observing timezone;
- overnight/shift profiles only after their policy is approved;
- readable, non-pressure copy and colour-not-alone state communication.

## 16. Explicit Non-goals

This contract does not approve or implement:

- schema, repository, or migration changes;
- automatic scheduling or rescheduling;
- automatic Today movement;
- calendar reads or writes;
- AI inference or AI-written state;
- backend storage or cloud sync;
- notifications or analytics;
- restore/import execution;
- energy prediction, biometric input, or sleep scoring;
- nutrition, dieting, weight, or medical advice;
- a detailed timetable or calendar grid;
- filling every remaining gap.

## 17. Decisions Still Requiring Approval

The locked direction above is sufficient to prevent incompatible implementation. These details still need an explicit decision before their affected code is written:

- whether the first release supports more than one work period per profile;
- how overnight and rotating-shift profiles bind to local dates;
- whether week-level profile exceptions precede full per-date overrides;
- the first-run UI for reviewing migrated anchors and enabling derivation;
- whether meal protection defaults to unavailable or ask first when a user creates a new window;
- whether custom profiles ship with the first implementation or a later one;
- how fixed commitments should be shared or copied across profiles;
- whether a user may create a separately confirmed exception to a work-hours planning-use rule, and which work modes may permit it; such an exception must never silently override a completely unavailable work period, commute or transition protection, fixed commitments, date-specific unavailable time, or another higher-precedence unavailable boundary;
- the exact candidate-window cap and minimum-gap policy;
- the long-term removal point for duplicated legacy settings fields.
