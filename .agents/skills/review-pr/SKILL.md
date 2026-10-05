---
name: review-pr
description: Use when independently reviewing a Life Rhythm PR against its bounded milestone contract and existing repository review rules.
---

# Review PR

Read [AGENTS.md](../../../AGENTS.md)'s Code review rules and ordered authorities. Take a fresh independent posture: do not rely on the implementer's narrative or claimed tests as proof. Identify live base/exact head and acceptance; inspect the diff plus directly affected callers, persistence and dependencies. Expand only for a concrete causal failure path, while surfacing serious safety/privacy/data-integrity/authority risk wherever found.

For supported findings, state triggering conditions, path, expected/actual behaviour, user consequence and evidence. Assign severity and exactly one disposition: **Block before merge**, **Track as follow-up**, or **Exclude from this review**. Severity alone does not decide merge; P2 acceptance failures can block, safely deferred P2s can be follow-ups. Do not invent findings.

Respect one substantive review and the consolidated-correction/targeted-verification stopping rule. Check [human gates](../../../docs/HUMAN_GATES.md). Output exact reviewed head and BLOCK, MERGE WITH FOLLOW-UPS or MERGE when the interface permits; obey findings-only schemas otherwise. The verdict does not itself perform a merge.
