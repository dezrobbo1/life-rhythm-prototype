# Gate 8A7B2 — Library, Settings and recovery convergence report

Status: **IMPLEMENTATION COMPLETE — HUMAN ACCEPTANCE PENDING**

## Baseline

- Repository baseline: `24868813e6e9d05390f8d477919242f0c76307ae` (main after PR #170)
- Branch: `feat/gate8a7b2-library-settings-recovery`
- Programme state: Gate 8A7B remains active. Gate 8A8 remains BLOCK. Gate 8B has not started.

## User outcome

### Library

- Configured rhythms now appear first in **Your rhythms**, with their on, paused or off state visible.
- Inactive catalogue entries sit in **More rhythm ideas** and remain suggestions until explicitly configured.
- Each rhythm has one state-appropriate ordinary action. Editing, pause/off controls and explanatory detail are secondary.
- **Add to Today once** remains separate from recurrence state.
- Quick Packs remain collapsed, preview-only ideas.
- Rhythm-specific export/check controls remain available under **Technical rhythm backup**.

### Settings and life shape

- Settings opens on the boundaries Life Rhythm needs for safe planning: all seven weekday assignments, usable-day limits, work boundaries and protected/open-capacity blocks.
- Appearance, the static calendar snapshot, scheduling preferences, duration-learning controls and Start Boost safety remain available through progressive disclosure.
- Closing and reopening advanced settings preserves unsaved component state.
- Reset-to-defaults is separated from the ordinary Save action.
- Browser-local, static-calendar and trial-status facts remain findable under **About this version**.

### Portability and recovery

- **Export portable backup** is the single prominent recovery/portability action.
- File selection, check, preview, typed replace confirmation and restore are grouped under **Restore from a portable backup**.
- Individual settings, Held, placement and specialist check/export tools remain available under **Individual and technical backup tools**.

## Preserved boundaries

This slice does not change:

- database or schema versions;
- migrations or portable-backup format;
- RhythmTemplate, RhythmPlan, recurrence revision or occurrence authority;
- enable/pause/off or add-once state transitions;
- scheduler or duration-learning semantics;
- static-calendar parsing or repair;
- account persistence/sync;
- external calendar writes.

Portable restore remains versioned, checked before restore, replace-only, confirmation-gated for a non-empty destination, stale-preview protected, atomic and recovery-generation fenced.

## Automated validation

- Focused Library, Settings and portable-recovery tests: 58 passed.
- Full test suite: 110 files passed, 1,378 tests passed.
- Production build: passed (`tsc -b && vite build`); the existing bundle-size advisory remains non-blocking.
- CSS includes narrow single-column reflow, wrapping actions, bounded controls and 16 px mobile form text. It does not hide horizontal overflow or restrict browser zoom.

## Human acceptance

Desktop and 390 px browser acceptance remain **PENDING** because this environment could build the product but could not attach its browser surface to the local preview. No human layout PASS is claimed.

Owner acceptance should use the exact PR preview and head:

1. In Library, identify a configured rhythm and whether it is on, paused or off.
2. Use its obvious state action; confirm **Add to Today once** is distinct from turning recurrence on.
3. Configure one catalogue suggestion.
4. Open Quick Packs and confirm they remain preview-only.
5. Open technical rhythm backup and confirm export/check remain reachable.
6. At about 390 px portrait, confirm Library search, filters, actions and configuration have no horizontal panning.
7. Open More → Settings and confirm planning days and life-shape boundaries lead the page.
8. Check all seven weekday assignments and the work/travel/protection controls.
9. Open and close Advanced settings; confirm edited, unsaved values remain.
10. Confirm the calendar is described as a static read-only snapshot, not a live provider.
11. Confirm **Export portable backup** is obvious.
12. Open restore, check a throwaway backup and confirm check alone changes no data.
13. Confirm replace-only consequence and typed confirmation are clear. Do not use the only live owner profile as a destructive fixture.
14. At about 390 px portrait, confirm Settings time/select controls, recovery preview and confirmation controls do not clip or pan horizontally.

Record preview URL, exact SHA, desktop/mobile browser and viewport, PASS/FAIL, and any confusing decision point.

## Remaining Gate 8A7B

Gate 8A7B3 remains responsible for populated Today, Plan/Changed, contextual relief, and integrated desktop/mobile/keyboard acceptance. Issues #168 and #160 remain open.
