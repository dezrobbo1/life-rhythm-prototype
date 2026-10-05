# Codex model and usage policy

Minimise usage while meeting [AGENTS.md](../AGENTS.md)'s engineering/review gates and [MVP_PLAN.md](../MVP_PLAN.md)'s acceptance criteria.

| Route | Suitable tasks |
| --- | --- |
| A — GPT-6 Luna / Low | Repository-state checks; mechanical documentation work; CI/status inspection; straightforward verification; simple deterministic edits. |
| B — GPT-6 Luna / Medium | Tightly bounded implementation with explicit contract; straightforward review corrections; low-risk mechanical work across files. |
| C — GPT-6.1 Sol / Medium | Normal non-trivial implementation; independent PR review; reasoning across subsystems; persistence/state changes; scheduler semantics; architectural interpretation. |
| D — GPT-6.1 Sol / High | Only justified by an unresolved difficult P1, genuinely ambiguous architecture, a difficult deterministic correctness issue, or failed Medium reasoning where additional reasoning is likely to help. |
| E — Stronger model | Exception only after documented failure or complexity justification. |

Use the least expensive available configuration reasonably expected to meet the gate. Escalate one level at a time; task length alone is not a reason. Missing credentials, network or access are capability problems, not reasoning problems. Record unusual escalation in the task contract or PR: initial route, concrete failure/complexity, next route and why it should help. Use currently available model identifiers; these labels are routing guidance, not invented runtime configuration syntax.

Repository Markdown cannot change the already-selected model of a running task. The owner or an available orchestrator must select the configuration for a new task/delegation. If routing control is unavailable, report that limitation and continue authorized work with the current model. Preserve the bounded review/correction stopping rule; do not increase usage through repeated unchanged full suites or broad review without a trigger.
