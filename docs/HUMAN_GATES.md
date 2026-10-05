# Human gates

Operational instructions subordinate to [AGENTS.md](../AGENTS.md), [PRODUCT.md](../PRODUCT.md), [MVP_PLAN.md](../MVP_PLAN.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). Preserve the [authority hierarchy](DOCUMENTATION_AUTHORITY.md).

## PRODUCT OWNER DECISION REQUIRED

Stop dependent work and report this exact label when:

- two current authorities materially conflict;
- a choice materially changes approved product behaviour or scope;
- roadmap ordering must materially change;
- acceptance requires subjective owner judgment.

State the evidence, affected decision and smallest concrete options. Resolve routine engineering choices within existing authority without asking the owner. Historical references or older snapshots do not override current authority.

## MANUAL ACTION REQUIRED

Stop dependent work and report this exact label when:

- a real device/browser walkthrough is required;
- credentials or provider consent unavailable to Codex are required;
- external account authorization is required;
- a production/destructive migration requires approval;
- payment or expenditure is required;
- a physical or longitudinal user trial is required.

Identify the exact build, path, action and required evidence or authorization. Continue independent authorized work where safe; do not represent a pending gate as passed. Browser automation may support evidence, but cannot replace owner or physical-device acceptance required by MVP_PLAN.md. Production/destructive operations and production data migration require explicit authority even when code is prepared.

Gate 8B baseline and Day 1 require explicit integrated Gate 8A8 PASS and the owner's accepted stable environment. Prepared protocols, issue closure and passing tests do not authorize longitudinal trial evidence. Account-backed continuity, one live read-only calendar and calm/mobile readiness remain prerequisites.

## Engineering work that does not require a human stop

Do not stop merely because tests fail, code is difficult, review finds P1/P2 defects, CI fails for a reproducible code reason, or ordinary refactoring is needed to satisfy the bounded milestone. Diagnose and correct confirmed blockers within scope, then rerun affected validation under AGENTS.md's review budget. Use **Block before merge**, **Track as follow-up**, or **Exclude from this review** based on evidence and acceptance, not severity alone.

If local source cannot safely be reconciled with authoritative live main, report **STALE WORKSPACE BLOCKER** before dependent implementation/publication. An actual missing access capability may require manual authorization; known-invalid terminal auth is not a blocker when the equivalent connected plugin operation is available.
