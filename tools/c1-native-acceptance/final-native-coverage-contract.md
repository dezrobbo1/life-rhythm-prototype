# Final C1 native coverage contract — 2026-10-10

This continuation completes the existing C1 authentication/account-metadata gate.
It changes no application behavior and starts no C2 storage work. The application
under test remains PR #180 SHA `07469f9f13aa3887a6ec7847b7b642a839651e63`,
Preview `dpl_4GvGzb8vWMvFuPpYjUaJSBv61Vtm`, at the exact immutable manifest host.

## Accepted fixture boundaries

| Row | Evidence boundary |
| --- | --- |
| Invalid/forged token, own/cross reads, protocol/query/head/conflict, UI, negative origin | Real immutable hosted application and genuine Supabase sessions |
| INSERT/PATCH/DELETE denial | Genuine A/B bearer requests against both real metadata tables; exact synthetic identity filters; HTTP 403 and SQLSTATE 42501 mandatory; before/after metadata snapshots equal |
| Incompatible stored protocol/schema, disabled, uninvited | Real hosted API and provider reads after exact disposable metadata preparation through the existing connected management plane |
| Already-issued session after disablement | Previously issued genuine A session reused after `trial_access.enabled=false`; application 403 and provider metadata empty |
| Genuinely signed expired token | Unmodified provider-issued A JWT, verified with configured issuer/public JWKS, then evaluated by the exact application source with isolated clock advanced beyond its signed `exp`; rejection before metadata request |
| Provider failure/503 | Exact application source with genuine verified A JWT, deterministic 503 metadata fetch interceptor; fail-closed 503 JSON/no-store; no real provider outage |

The last two rows are explicit source-runtime fixtures within the hosted native
job, not claims of a wall-clock expired HTTP request to Preview or a live Supabase
outage. No signing key is minted or retained during acceptance. The child process
has an empty environment, no network, passwords, bypass, GitHub or administration
credentials. Only the genuine A token, public JWKS/key and synthetic account
expectation enter private stdin; only fixed row enums exit. Signature forgery
must fail separately. The exact eight source/dependency manifests are Git-blob
pinned and compiled before the secret step from the immutable application SHA.

## Privileged setup versus application under test

Use the existing Supabase connection for project `lfwadowwdvcnibjkeerg` only.
No new CI fixture-admin secret, Auth signing authority, auth.users SQL mutation,
application hook, Vite variable or provider outage is introduced. Existing A/B
identities are disposable synthetic identities. C1 disabled means metadata
eligibility disabled; it does not assert instant Auth JWT revocation or provider
ban. Uninvited B remains genuinely authenticated while both its invitation and
head metadata are absent. Browser and application always use ordinary bearer
sessions; browser routing still prohibits all metadata writes.

Before dispatch privately snapshot the exact A/B trial_access and account_heads
rows, including original updated_at, and hash canonical snapshot bytes. Refuse
unrecognized accounts or unexpected baseline. Keep only the digest in evidence.
The existing owner-authorized external connector observation mechanism is used;
this adds fixed fixture stages, not another observer identity or trust design.

## One-run operator sequence

All source work must be reviewed and merged before a bypass exists. Confirm normal
deployments stable, record main/app/deployments, verify A/B secret names without
reading values, and enable only the reviewed main harness. Generate one temporary
bypass, store only `C1_AUTOMATION_BYPASS_SECRET` in `c1-native-preview`, and freeze
all source/deployment operations until revocation. The mandatory Vercel system-env
designation is explicitly authorized for this frozen window; no deployment may
receive it. App source must not consume it and no VITE mapping may expose it.

Dispatch once with explicit `automation-bypass`. Publish the existing fresh pre
receipt after authenticated exact Vercel metadata reads. Monitor the fixed safe
`C1_FIXTURE_WAIT_...` stage signals in the native job. For every fixture stage:
perform only the following transaction on exact A/B metadata; read back and verify
state; perform a fresh Gmail-linked Vercel deployment lookup; then publish one
compact canonical format-3 receipt in #179 using `connectorReceipt`. Bind the
actual run/attempt, harness, pre receipt and original baseline digest. The native
job waits at most 90 seconds per stage; invalid/edited/ambiguous evidence fails
immediately, with no automatic acceptance retry.

| Stage | Exact prepared state |
| --- | --- |
| fixture-baseline | Original A/B snapshots; no mutation. Runner snapshots metadata around all expected-denial writes. |
| fixture-protocol | Restore baseline; set only A account_heads.protocol_version=2. |
| fixture-schema | Restore baseline; set only A account_heads.canonical_schema_version=2. |
| fixture-disabled | Restore baseline; set only A trial_access.enabled=false. |
| fixture-uninvited | Restore baseline; delete B account_heads first, then B trial_access (foreign key order). |
| fixture-restored | Restore trial_access first and account_heads second from exact snapshots; verify canonical digest equality including timestamps. |

Use parameter-bound values where supported, otherwise constant exact synthetic
UUID/issuer predicates and validated snapshot types. No arbitrary SQL from runner
or application. Restoring baseline before each stage prevents accidental combined
conditions. All row snapshots/restores are performed transactionally through the
secure management plane, not with A/B tokens. If a denied write succeeds, stop
probes immediately; restore original synthetic metadata and record C1 FAIL.

Restoration is requested in finally on success and failure. The external operator
also restores independently if job cancellation/runner loss prevents signaling.
Never claim cleanup PASS without verified restoration. After native completion,
verify the actual successful GitHub job, exact needs-output digest and fresh real
restored baseline, then publish the bound post receipt. Post independently rereads
the restoration receipt and native job. Every required row and valid restoration
binding is mandatory; absent/failed rows cannot finalize PASS.

Immediately after evidence capture, on PASS or FAIL: revoke the exact bypass,
remove its environment secret, prove the old key no longer admits and ordinary
protection applies, and compare deployment IDs/timestamps throughout the window.
Restore any remaining fixture state before closing. No source correction or merge
is allowed while bypass exists. Only after revocation may a genuine full C1 PASS
lead to final #180 review/merge. Keep #179 open as the programme tracker and stop
before C2. Detailed temporary automation is a cleanup candidate, not permanent
application architecture.
