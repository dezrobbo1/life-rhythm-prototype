# Trial Account And Auth Boundary Contract

Status: Current boundary contract with a narrow implementation subset

Current implementation is the opt-in Clerk identity/local-namespace subset; no account data upload is implemented yet. MVP_PLAN.md now requires explicit account-backed durability before the owner longitudinal trial. This contract records the existing no-silent-upload safety boundary; the 8A7C contract must define authorized data movement, verified account ownership, local replica/sync, migration and access policy before implementation. Authentication alone is not durability. Legacy data remain local until a previewed/confirmed migration; no unrelated profile is silently merged or uploaded.

This contract defines the boundary for trial accounts and login in Life Rhythm. It does not itself authorize backend data movement; that authority belongs to the reviewed 8A7C data-flow contract and implementation.

## 1. Trial Account Purpose

## 1. Trial Account Purpose

Future trial accounts may help Life Rhythm:

- allow invited testers to access the app independently,
- support future multi-person trials,
- prepare for user-scoped local data,
- protect trial access without making the app public by default.

Trial accounts are not intended to create a social system, public accountability layer, leaderboard, group challenge, or progress comparison feature.

The purpose is controlled access and clearer user identity, not pressure.

## 2. Authentication Vs Data Storage

Authentication and data storage are separate decisions.

Login identifies the user. It does not automatically authorize Life Rhythm data to be uploaded, synced, shared or inspected. The current implementation remains local-only. The revised owner-trial roadmap requires a separately reviewed account-backed durability boundary before longitudinal use.

Rules:

- Existing local data remain local until an explicit previewed/confirmed migration.
- Gate 8A7C must define the authorized canonical data classes, verified account ownership, local replica/outbox, synchronization acknowledgement, conflict handling, deletion/reset fencing and recovery.
- The current login shell protects access and selects a local namespace; it does not itself provide durability or sync.
- Backup/export remains user-controlled and independent of normal account continuity.
- Personal task, rhythm, setup, re-entry, protected-time and behavioural data must not become remote data by accident or merely because a user signs in.
- Server-side account identity must be verified and must not rely on a client-supplied owner ID.

## 3. Core Rule

## 3. Core Rule

Login may identify the user.
Login must not silently upload Life Rhythm data.

## 4. Trial Access Model

The future trial access model should be invite-only by default.

Rules:

- No public signup by default.
- No public profiles.
- No social features.
- No public accountability.
- No admin reading personal task data by default.
- No analytics by default.
- Invited account access should be minimal and clear.
- Access controls should support trials without changing the app into a social or monitoring product.

If public signup is considered later, it needs a separate review and contract update.

## 5. User-Scoped Local Data Direction

Local data is scoped by authenticated user ID when the opt-in login shell is enabled.

This is a local data safety boundary, not cloud sync.

Requirements for the current shell and any future expansion:

- Signed-in local data should be namespaced by user ID.
- Signed-out and signed-in transitions need explicit handling.
- The app must avoid one tester seeing another tester's local data on shared devices.
- Signing out must not silently delete local data.
- Signing in must not silently merge unrelated local data.
- Backup and export wording should make clear which account or local profile the backup belongs to.
- If there is pre-login local data, a future PR must define whether it stays signed-out, is linked to a user, or is exported first.

Shared-device behavior must be tested before external trials.

## 6. Privacy Boundaries

Life Rhythm data can include sensitive personal information.

Examples include:

- routines,
- ADHD-related self-management patterns,
- protected time,
- family time,
- food, sleep, and movement rhythms,
- task avoidance and re-entry patterns,
- personal notes,
- hidden edges around tasks,
- setup preferences,
- local backup and export details.

Future auth work must treat this data as private by default.

Boundaries:

- Admins must not read personal task data by default.
- Login must not imply monitoring.
- Trial access must not imply data review.
- Analytics must not be introduced as part of login.
- AI data upload must not be introduced as part of login.
- Any future data upload needs a separate sync/privacy contract and explicit user-facing language.

## 7. Auth Provider Direction

The current narrow identity shell uses Clerk. This documentation consolidation does not add another provider or expand the current shell into public signup, cloud data, or external-trial operations.

Future provider decisions:

- Supabase should be considered only if and when cloud data and Postgres-backed sync are approved.
- Firebase, Auth0, and other providers remain alternatives, but need separate review before use.

Provider choice should be evaluated against:

- invite-only trial access,
- local-first boundaries,
- user-scoped local data,
- low implementation surface,
- clear sign-in and sign-out behavior,
- no automatic data upload,
- no analytics requirement.

Auth provider setup must not be bundled with sync, backend data storage, or AI data upload.

## 8. Remaining Implementation Sequence

The current narrow shell covers identity and local namespace separation. Remaining work is governed by MVP_PLAN.md:

1. Current-shell/auth-boundary verification. **Implemented narrow subset.**
2. Gate 8A7C — reviewed account/storage/sync boundary and auth-required deployed configuration. **Required before owner longitudinal trial.**
3. Gate 8A7C — account-backed persistence/hydration, explicit local-profile migration, offline/reconnect/conflict/delete/recovery behaviour. **Required before owner longitudinal trial.**
4. Operational invite/account lifecycle for external testers. **Deferred to small-beta readiness.**

The owner-trial account boundary should remain narrow: identify the owner, protect access, provide durable account continuity and preserve local/offline control without turning Life Rhythm into a social or monitoring product.

## 9. What The Current Or Future Login Shell May Include

## 9. What The Current Or Future Login Shell May Include

The current shell and future narrow extensions may include:

- sign in,
- sign out,
- invited account only,
- minimal user profile display,
- protected app shell,
- signed-out landing screen,
- local user namespace selection or creation,
- clear account-aware backup/export copy.

It may not imply that data is being uploaded or synced.

## 10. What A Future Login Shell Must Not Include

A future login shell must not include:

- cloud data sync,
- admin access to personal data,
- public signup by default,
- public profiles,
- social or accountability features,
- gamified progress,
- medical or clinical claims,
- analytics,
- notifications,
- AI data upload,
- scheduler behavior,
- calendar integration,
- import/restore execution,
- migration execution,
- task placement logic.

Any of those areas require a separate contract and review before implementation.

## 11. Future Testing Gates

Future auth PRs must prove:

- Signed-out users see only the auth or landing shell.
- Signed-in users can enter the app.
- Signing out does not delete local data silently.
- User A local data is not shown to user B on the same browser.
- Backup and export remain user-controlled.
- Login does not upload Life Rhythm data.
- Login does not run sync.
- No scheduler or calendar behavior is added.
- No AI behavior or AI data upload is added.
- No analytics calls occur.
- No public signup is exposed unless a later contract approves it.
- No admin path reads personal task data by default.

Tests should cover shared-browser transitions, signed-out state, signed-in state, and data namespace separation before external tester use.

## 12. Non-Goals For This Boundary Update

This boundary update does not expand the current narrow identity/local-namespace shell.

It does not:

- add a second auth provider,
- expand the current Clerk shell into public signup or external-trial operations,
- add backend services,
- add sync,
- upload local data,
- change Dexie schema,
- add analytics,
- add notifications,
- add scheduler behavior,
- add calendar integration,
- add AI integration,
- add task placement,
- add import/restore execution,
- add migration execution,
- alter root GitHub Pages behavior.

Root production files remain protected.
