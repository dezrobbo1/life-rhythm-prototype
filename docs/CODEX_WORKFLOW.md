# Resumable Codex workflow

Follow [AGENTS.md](../AGENTS.md), the [documentation hierarchy](DOCUMENTATION_AUTHORITY.md), [human gates](HUMAN_GATES.md) and [model policy](CODEX_MODEL_POLICY.md). [MVP_PLAN.md](../MVP_PLAN.md) alone defines delivery/readiness. [CURRENT_STATE.md](../CURRENT_STATE.md) is an operational snapshot to verify, not new authority.

## GitHub access boundary

Verified on 2026-10-05 through the connected GitHub plugin for `dezrobbo1/life-rhythm-prototype`: account `dezrobbo1`; repository reads succeed; repository permissions report `push: true`. Exposed write actions include `create_branch`; `create_file`, `update_file`, `delete_file`; `create_blob`, `create_tree`, `create_commit`, `update_ref`; `create_pull_request`, `update_pull_request`; and `merge_pull_request`. These names refer to GitHub plugin tools, not shell commands. Tool exposure/permission metadata does not bypass branch rules, checks, human gates or task restrictions; do not perform a write solely to test permission.

Terminal `GH_TOKEN` is currently known-invalid; terminal GitHub write authentication is unverified. This is separate from plugin authentication. Recheck the relevant connection on a future task rather than assuming this dated observation persists.

- Prefer connected GitHub plugin actions for GitHub mutations. Do not repeatedly retry known-invalid `gh` authentication or require terminal `git push` when an equivalent plugin action exists.
- Keep the local workspace as implementation/test workspace; plugin live state is authoritative for remote branches/PRs.
- Before implementation, read live main SHA, open PRs and local HEAD/status/source. Preserve unrelated edits. If main advanced, inspect intervening changes and safely reconcile with current main; if impossible, report **STALE WORKSPACE BLOCKER**.
- Avoid duplicating an active implementation PR. A separate governance PR may coexist with it, but must record unfinished acceptance honestly.
- Before publication, recheck live main and existing branch head. Publish only the validated intended files from the verified base; preserve other files and use non-forced ref updates. If either base or head changed, reconcile and renew affected evidence before publishing.
- Before merge, verify exact PR head/base, checks, acceptance, review dispositions and human gates. Never publish against unverified/stale source. Permission or network failures are not solved by model escalation.
- Never put tokens, credentials or real personal data in repository files, task contracts or PR bodies.

## Future loop

Verify live state → plan next approved slice → implement → test → PR → independent review → consolidated correction if needed → targeted verification and final merge gate → merge when permitted → update CURRENT_STATE → determine next approved slice.

Each slice has a written implementation contract: authoritative gate, bounded outcome/non-goals, affected boundaries, acceptance, required validation, human dependencies and initial model route. A contract refines MVP_PLAN.md and cannot reorder it materially or remove prerequisites. Planning challenges sequencing against live evidence; authority conflicts and product changes use HUMAN_GATES.md.

The reviewer takes a fresh independent posture and treats implementation as untrusted. Follow AGENTS.md's exact disposition model and stopping rule: one substantive review, one consolidated correction pass, affected verification and final validation. Severity is evidence, not the merge rule. A valid P2 breaking acceptance can block; a safely deferred P2 can be a recorded follow-up. Another substantive pass needs a new material blocker, changed risk-bearing design or owner requirement. Never invent findings to justify review.

An ordinary development PR may merge only after all defined gates pass and any task-specific merge restriction is satisfied. Human acceptance remains pending until actually performed on the attributable build. After merge, fetch authoritative main and update CURRENT_STATE with completed scope, remaining acceptance, next approved slice, blockers, PR and date. If programme/readiness changes, update MVP_PLAN.md as well; the handoff cannot silently promote readiness. A documentation follow-up uses a focused branch/PR and the same governance checks.

This framework makes tasks resumable and suitable for manual or future orchestrated chaining. Repository Markdown and skills do not launch tasks, change running models, create an external infinite orchestrator or authorize work beyond the approved MVP. This pilot PR is draft-only and must not be merged during its creation task.

## Repository skills

Instruction-only skills use `.agents/skills/<name>/SKILL.md`, with required YAML `name` and `description` and no runtime/model metadata. Format/location checked against [current official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) on 2026-10-05. Invoke with `$<name>` in a host that supports repository skill discovery; otherwise read the file explicitly. Runtime discovery has not been proved merely by writing the files.

- [plan-next-milestone](../.agents/skills/plan-next-milestone/SKILL.md)
- [implement-milestone](../.agents/skills/implement-milestone/SKILL.md)
- [review-pr](../.agents/skills/review-pr/SKILL.md)
- [resolve-review](../.agents/skills/resolve-review/SKILL.md)
- [final-merge-gate](../.agents/skills/final-merge-gate/SKILL.md)
