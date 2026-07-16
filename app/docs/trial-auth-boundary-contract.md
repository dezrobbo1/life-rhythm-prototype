# Trial Account And Auth Boundary Contract

Status: Current boundary contract with a narrow implementation subset

Current implementation note: `/app` has an opt-in Clerk identity shell and separate user-scoped local namespaces. Identity does not imply upload or sync. Invite-only operational rollout, broader account workflows, and any cloud movement remain future work. See `app/docs/life-rhythm-current-design-spec.md` and `app/docs/DOCUMENTATION_AUTHORITY.md` for current status.

This contract defines the boundary for invite-only trial accounts and login in Life Rhythm.

It does not approve or implement backend services, cloud sync, data upload, analytics, notifications, scheduler behavior, calendar integration, AI integration, task placement, import/restore execution, migration execution, or any schema change beyond the narrow current identity/local-namespace shell.

The current login shell is an identity and access layer first. It must not quietly change the local-first data model.

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

Login identifies the user. It does not automatically mean Life Rhythm data should be uploaded, synced, shared, inspected, or moved out of the local app.

Rules:

- Local-first data remains local unless a later sync contract explicitly approves upload.
- Cloud sync is a separate future decision.
- The current login shell protects access to the app without enabling sync.
- The current account ID namespaces local data, but does not upload it by default.
- Backup and export remain user-controlled actions.
- Personal task, rhythm, setup, re-entry, and protected-time data must not become cloud data by accident.

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

The current narrow shell covers identity and local namespace separation. Remaining work is:

1. Auth boundary contract and current-shell verification. **Current.**
2. Operational invite-only access verification. **Remaining before external testers.**
3. Account-aware backup and export wording. **Remaining.**
4. Cloud sync contract, only if needed later.

The login shell should come before any external multi-person trial, but it should remain narrow: identify the tester, protect access, and preserve local-first behavior.

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
