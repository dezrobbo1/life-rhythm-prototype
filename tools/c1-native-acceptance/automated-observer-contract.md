# C1 external connector automation

Status: bounded observer redesign, default OFF; hosted acceptance NOT_RUN.
Authority: owner authorization on 2026-10-09 for a bounded automated-observer
redesign, with one independent security review before activation. PR #181 is
already merged at `31d325f7058e16ecaa9c426fc6030f8e1587a31d`. This follow-up
changes acceptance infrastructure only; PR #180 remains draft/unmerged.

## Explicit trust change

The earlier design required a separate GitHub User to post a provider receipt
and approve a protected environment. No such independently controlled account
is available. This design **does not claim independence from the repository
owner**, a second account, a bot identity, or a provider-signed statement.

Instead, the owner authorizes an external Work executor using the authenticated
Gmail-linked Vercel management connector and GitHub connector. Its real GitHub
principal is owner User `228294552`, even when that user initiated the workflow.
The owner/authorized executor is accountable for making each genuine fresh
provider lookup. GitHub proves that principal's receipt authorship, timestamp
and unchanged bytes. The harness cannot cryptographically prove the management
lookup occurred or detect a deliberately fabricated receipt by that principal.
That is the explicit trusted-operator assumption, not a second-person control.

The separation is between external management capability and test execution.
The acceptance workflow receives no Vercel administrative credential, no GitHub
comment-write permission, and no human-review bypass credential. Its job token
cannot create an owner-authored comment. Application PR code is never checked
out as executable workflow code. All jobs checkout the reviewed full main SHA H
with `persist-credentials:false`; dispatch/workflow identity and main head must
match H. The existing exact OIDC protection requirements remain unchanged.

## Three-job sequence

1. `C1 external pre admission` validates source/check/review preflight and waits
   up to 90 seconds for one format-3 pre receipt on issue #179. It has no account
   secrets or OIDC permission. It emits the exact receipt ID, body digest and its
   actual GitHub job ID through reviewed `needs` outputs.
2. `C1 native test phase` receives those three values, verifies the actual
   successful pre job's run/attempt/head/name/times and rereads the exact receipt
   before entering the account-secret step, each login and final cleanup.
   Missing output never falls back to a comment search. All existing native
   transport, identity, cleanup, budget and browser controls remain binding.
3. `C1 external post verification` runs only after native success. It verifies
   the exact successful native job and the digest/bytes supplied by native
   `needs` outputs. It waits up to 90 seconds for a new external post receipt
   binding that digest, the pre receipt and GitHub's actual job completion time.
   It has no account passwords, provider credential or OIDC permission. Scoped
   completion still reports gate BLOCK for missing genuine fixture rows.

Both waits retry only absence of an observation, never a failed test, invalid
receipt, network error or stale evidence. This is one acceptance attempt.
Four pages of 100 issue comments are the maximum; incomplete pagination or more
than one receipt for the run/phase blocks. Fixed job timeouts bound a hung API.
Pre observations expire after 20 minutes; post after five. Receipt creation must
be within 30 seconds of the observation and unedited. Replay, unknown/duplicate
fields, other authors, source/origin/harness/run drift and conflicting receipts
block. Post observation and publication must follow actual native completion.

## External executor procedure

Before dispatch, independently review and authorize H, retarget the manifest to
the final reviewed application SHA and exact immutable Preview, approve that
origin, and configure the existing native/post environments for main only.
Native secrets remain environment-scoped. Under this mode an environment does
not require a second-human reviewer; receipt admission is the automated gate.
Do not weaken global Vercel protection. Keep `C1_NATIVE_ENABLED` false until all
other prerequisites, including source review and secure A/B credentials, pass.

For each phase, use GitHub's authenticated run/job APIs to verify run ID,
attempt=1, H, repository IDs, event, main branch and exact workflow path. The
native workflow has no dispatch inputs for receipts or phase bytes.

Make a **new** `get_deployment` call with the Gmail-linked Vercel connection,
fixed team `team_EeRBGaTcRamnOpGbT1RswHVc` and pinned immutable deployment ID.
Require exact ID/URL/project, Git source SHA, READY and `target:null` (Preview).
Do not use a cached response, branch alias, bot status, screenshot or app claim
as the fresh metadata observation. Select only public attribution fields;
never publish raw provider data or credentials. `observer-receipt.mjs` provides
the strict projection, not a substitute for that real connector call.

For post, obtain the fixed native `phase.json` through the GitHub artifact
connector, verify artifact/run/head/name provenance and the successful exact
native job, compute exact phase digest/bytes, and apply `verifyPending` before
projection. The post job independently compares the receipt's digest against
its native `needs` bytes, so an unrelated artifact cannot endorse other output.
Publish only `JSON.stringify(record)` as an issue #179 comment through the
GitHub connector within 30 seconds. Then verify the server comment bytes and
metadata. No environment approval click or fabricated distinct identity occurs.
An unavailable executor, timeout or missing post leaves C1 BLOCK.

This mode requires a live Work executor during the single run. It is automated
by the executor, not an unattended scheduled service. It adds no provider token,
paid resource, production setting or durable secret. Revocation: disable the
enable variable, clear H authorization and observer IDs, stop any running job,
and remove test secrets when no longer needed.

## Validation and scope

Red-first tests reproduce unsupported automated admission and missing interfaces
against the merged harness. Offline tests cover genuine same-owner authorship,
forgery/edit/replay/ambiguity/staleness, source/run drift, strict pre-job binding,
post digest/completion binding, bounded waits and metadata projection. Existing
human-mode tests remain valid, but cannot silently admit format-3 automation.
The new PR verification workflow runs only offline tests with no secrets.

Application files, dependencies, synthetic fixtures and provider settings are
unchanged. Existing application source evidence may be reused under AGENTS.md;
offline harness verification cannot establish hosted acceptance. C1 is metadata
authentication/account boundary only. C2, C3 and final owner trial are excluded.
