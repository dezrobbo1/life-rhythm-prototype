# Gate 7B — descriptive behaviour statistics contract

## Boundary

Gate 7B deterministically derives descriptive statistics from the schema-valid Gate 7A behaviour-event ledger. It reads observed facts and does not write events, tasks, placements, scheduler plans, calendars, preferences, or a statistics cache. Repeating the calculation over the same trusted events produces the same result regardless of row order.

These values describe what the application observed. They do not explain why an action happened, infer what the person prefers, score behaviour, or authorize scheduler changes. In particular, a `schedulerPlacementMoved` count means the scheduler moved a placement; it is not a user rejection.

## Statistics

### Completion duration

Only schema-valid `taskCompleted` events with an `actualMinutes` fact contribute a duration sample. Gate 7B reports:

- completion-event count;
- count of completion events without `actualMinutes`;
- duration sample count;
- median actual minutes;
- minimum observed minutes;
- maximum observed minutes;
- deterministic upper-quartile actual minutes (nearest-rank, used by later Gate 7E as a conservative observed estimate);
- the same duration summary grouped by `taskId` and by `templateId` when that identifier exists.

Incomplete lifecycle history is not converted into duration. Empty groups use a zero sample count and `null` summary values. Minimum, maximum and upper quartile are descriptive observed summaries, not a confidence interval.

### Factual event counts

Gate 7B exposes counts under the exact source event names:

| Area | Counted events |
| --- | --- |
| Task lifecycle | `taskStarted`, `taskCompleted`, `taskMinimumAchieved`, `taskParked`, `taskNotToday`, `taskDeferred` |
| User placement | `userPlacementCreated`, `userPlacementMoved`, `userPlacementRemoved` |
| Scheduler placement | `schedulerPlacementAdded`, `schedulerPlacementMoved`, `schedulerPlacementRemoved`, `schedulerPlacementVariantChanged` |
| Undo | `schedulerRepairUndone` |

It also reports total valid-event counts by the recorded `source` and `provenance.origin`. These are provenance summaries, not causal interpretations.

### Local-time observations

`taskStarted` and `taskCompleted` events contribute to separate local-time counts. The event's `occurredAt` instant is interpreted in its validated IANA `timezone`; the ISO timestamp's text offset is not used as a substitute for that timezone.

| Bucket | Local clock time |
| --- | --- |
| morning | 05:00–11:59 |
| midday | 12:00–13:59 |
| afternoon | 14:00–17:59 |
| evening | 18:00–22:59 |
| night | 23:00–04:59 |

Each action has an explicit sample count. Gate 7B does not calculate an acceptance rate because the current ledger has no matched opportunity denominator that would make such a rate truthful.

## Read health

The statistics reader preserves the Gate 7A collection-read result:

- `ok`: all rows were valid; the result includes valid-event and zero invalid-record counts;
- `partial`: statistics use only trusted valid events and report both the valid-event and invalid-record counts;
- `readFailed`: the read errors are returned and no empty or partial statistics are manufactured.

An empty successful ledger is distinct from failure: it returns zero sample counts and `null` duration summaries.

## Reproducibility and privacy

Statistics are calculated in memory from the local Gate 7A ledger. Gate 7B adds no database version, migration, persisted aggregate, network transport, telemetry, external-calendar authority, or scheduler authority. The existing behaviour-history export and protected delete remain the controls for the underlying observed facts; derived values disappear or change when those facts do.

## Deferred

Gate 7B does not implement:

- preference hierarchy or preference inference;
- confidence, contradiction learning, or predictive associations;
- recency weighting or decay;
- scheduler adaptation or ranking changes;
- subjective or psychological explanations;
- the final “What Life Rhythm has learnt about me” interface.

Those require later explicit milestones and must preserve the distinction between observed fact, descriptive statistic, and inference.
