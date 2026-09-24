# Gate 7E — explainable personal duration learning v0

## Boundary

Gate 7E is the first scheduler-adaptive behavioural-learning slice.

It derives a bounded duration hypothesis from trusted Gate 7A completion facts and uses that hypothesis only when projecting the **Normal** scheduling variant of a matching template. It does not rewrite the persisted Minimum, Normal or Full task/template definitions.

The slice is deliberately narrow:

- template-scoped evidence only;
- schema-valid `taskCompleted` behaviour events only;
- positive `actualMinutes` samples only;
- no overall-person fallback;
- no Area or Task type duration inference;
- no preferred-time inference;
- no psychological or physiological explanation;
- no neural network, contextual bandit, reinforcement learning or LLM.

## Evidence and epistemic levels

Gate 7A completion `actualMinutes` remains the observed fact. Gate 7B duration summaries remain descriptive statistics.

Gate 7E adds a separate scheduling hypothesis. For each template with positive completion samples it derives:

- sample count;
- median actual minutes;
- observed minimum and maximum;
- deterministic upper-quartile actual minutes;
- bounded confidence: `insufficient`, `low`, or `moderate`.

The upper quartile is a conservative scheduling estimate, not a confidence interval and not a clinical prediction.

Zero-minute observations remain valid historical facts where the Gate 7A schema permits them, but are excluded from predictive duration evidence because scheduler task variants must have positive duration.

## Automatic adaptation threshold

The v0 policy is deterministic:

- fewer than 3 positive template-linked samples: descriptive only, no automatic duration adaptation;
- 3–4 samples: low-confidence automatic estimate;
- 5 or more samples: moderate-confidence automatic estimate.

The central descriptive estimate is the median. The scheduler reservation uses the deterministic upper quartile.

These thresholds are product-trial policy, not an ADHD-wide rule or a statistically validated clinical threshold.

## Read health

Learning authority is stricter than descriptive reporting.

- `ok`: trusted evidence may drive automatic duration adaptation.
- `partial`: valid observations may still be displayed descriptively, but automatic learnt-duration adaptation is paused because the ledger is not fully healthy.
- `readFailed`: no behavioural evidence is manufactured or used.

An explicit user duration correction is independent user authority and may still apply when behavioural evidence is unavailable, provided the explicit control store itself is healthy.

Malformed or unreadable duration-control state fails closed: inferred learning and stored corrections are not guessed or replaced.

## User authority

A versioned sidecar in the existing local settings store contains only explicit user controls:

- `disabled`: use the saved Normal duration for that template;
- `override`: use the user's corrected positive whole-minute duration.

No derived duration estimate is persisted in the control sidecar.

Per-template edits use target-scoped optimistic concurrency. A stale edit to the same template is rejected, while unrelated template edits can merge without moving shared metadata backwards.

Resetting a control removes that explicit override/disable and allows healthy evidence to drive learning again.

## Scheduler projection

Duration learning is applied at the canonical scheduling projection boundary.

For a matching template:

- Minimum is unchanged;
- Normal receives the current learnt or user-corrected scheduler duration;
- Full is unchanged;
- persisted task/template records are not mutated.

The projected Normal variant carries duration provenance including the saved Normal duration and the evidence/control source.

The deterministic scheduler continues to own feasibility, hard constraints, protected time, Reduced Day semantics, explicit preferences and schedule stability.

## Repair and schedule stability

The accepted scheduler state records the currently applied duration-learning projection so live evidence/control changes can be detected.

When the **scheduler-effective authority or duration** changes for a template, future scheduler-owned **Normal** placements of that template may be released for bounded rolling repair.

Evidence-only changes such as a new sample count or a shifted median do not release placements when the effective scheduler duration and authority source are unchanged. Minimum and Full placements are not released merely because the template's Normal duration evidence changed.

The scheduler state may still refresh current evidence metadata without requiring a visible schedule move.

Undo restores the prior applied duration-learning snapshot. Because live evidence/control remains canonical, a later ensure operation can reconcile the plan again if the restored plan no longer matches current duration authority.

## Behaviour-history deletion

The behaviour ledger remains the canonical source of learnt evidence.

Deleting behaviour history removes those derived duration observations. The Reset workflow immediately asks the private-plan coordinator to reconcile an existing plan; it does not create a private plan merely because history was deleted:

- learnt durations fall back to persisted saved Normal durations when evidence disappears;
- explicit user corrections remain authoritative because they are stored separately as user controls;
- tasks, settings, calendars and user-authored task variants are not rewritten by the learning layer.

## Explanation and controls

Setup exposes a bounded **Duration learning** panel.

It shows, where available:

- template name;
- saved Normal duration;
- trusted positive completion sample count;
- median;
- conservative upper-quartile estimate;
- current learnt reservation and confidence.

The user can:

- use the saved duration;
- enter a corrected whole-minute duration;
- reset the explicit control to use learning again.

Automatic placement provenance records when a learnt or user-corrected duration affected a Normal placement. The existing “Why this time?” presentation translates that provenance into grounded duration copy without an LLM.

## Deferred

Gate 7E does not add:

- category/Area/Task type duration learning;
- variant-specific learned duration, because the current completion evidence does not establish which execution variant produced the observed duration;
- time-of-day preference inference;
- repeated-move/rejection learning;
- transition-duration learning;
- recency weighting or decay;
- subjective restoration/enjoyment learning;
- a broad “What Life Rhythm has learnt about me” dashboard;
- experimentation, contextual bandits, reinforcement learning or AI.

Those require later evidence and product decisions rather than being silently inferred into this slice.

## Exit review

Gate 7's stated exit condition is that a small set of scheduling choices can improve from the user's own history while remaining explainable and correctable.

Gate 7E supplies one such bounded choice: Normal duration reservation for repeated template-linked work. After this PR, perform a Gate 7 exit review before deciding whether another learning slice is necessary or whether the product should move to Gate 8 personal-trial validation.
