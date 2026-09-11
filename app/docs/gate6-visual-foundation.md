# Gate 6 visual foundation

Status: Gate 6B shared presentation foundation.

This document records the reusable visual contract introduced before the Day Line, Now/Later/Changed Today surface, Held consolidation, Capture redesign, or navigation cutover. It is a presentation contract only. It does not change scheduler, persistence, lifecycle, Reduced Day, Minimum Done, re-entry, calendar, or navigation semantics.

## Purpose

Gate 6 needs to make a powerful scheduler feel simpler without hiding state truth or deleting capability. The shared foundation therefore standardises hierarchy before later screens start removing visible machinery.

The target remains:

> Power underneath. Calm on the surface.

## Hierarchy

Use visual strength to communicate interaction importance, not productivity value.

1. **Primary object** — at most one dominant current object in a local surface. Use `.surface-primary-object` or `Card variant="primary"` when a later Gate 6 slice genuinely has a single dominant object.
2. **Quiet section** — related content with normal structural separation. Default `Card` and `.surface-quiet-section` are intentionally low-shadow.
3. **Ledger row** — compact repeatable information. Use `.surface-ledger` with `.surface-ledger-row` instead of creating a card for every item.
4. **Status/notice** — truthful loading, partial-data, failure, or short changed-state communication. Existing `.surface-read-state` and the shared `.surface-status` grammar use the same visual language.
5. **Relief sheet/modal** — temporary focused interaction. Existing `Modal` remains the interaction primitive; Gate 6B only normalises its responsive shape and focus presentation.

Colour must not imply that productive work is morally better than recovery, protected time, or holding something safely for later.

## Typography and measure

The app keeps a local/system font stack; Gate 6B does not add a web-font dependency.

Shared tokens provide:

- `--text-xs` through `--text-2xl` for a restrained hierarchy;
- `--leading-tight`, `--leading-body`, and `--leading-relaxed`;
- `--measure-copy` for readable explanatory text;
- `--font-mono` and `.surface-time` for compact time/data text where fixed-width numerals materially help.

The screen title remains the only `h1` inside a screen. Later slices should prefer clear section headings over repeated oversized cards.

## Layout widths

Gate 6B increases the shell's available desktop measure while retaining a narrower focused Today/Reset column:

- `--layout-focus`: current-action-oriented surfaces;
- `--layout-content`: Plan, Pool, Library, and Setup content;
- `--layout-wide`: outer application canvas.

This prepares Plan and later Held surfaces to use desktop space without forcing Today to become a dashboard.

## Controls

All shared controls retain a minimum 44px (`2.75rem`) target height.

`Button` now supports:

- `primary` — one locally preferred action;
- `secondary` — ordinary reversible action;
- `quiet` — low-emphasis disclosure or navigation-adjacent action;
- `danger` — explicit destructive/consequential intent only.

Do not use `primary` on several competing actions merely to make them noticeable.

## Cards and ledger rows

`Card` now supports:

- `default` — ordinary quiet section;
- `primary` — stronger current-object boundary;
- `quiet` — semantic section without card chrome.

The previous decorative accent strip and broad card shadows are removed by the shared foundation. Later Gate 6 work should migrate repeated lists toward ledger rows rather than reintroducing card soup.

## Focus and motion

Keyboard focus uses one theme-aware visible ring across buttons, links, form controls, summaries, and custom tab stops. Existing modal focus trapping/restoration remains authoritative.

When the operating system requests reduced motion, non-essential transition durations are effectively removed. No Gate 6 workflow may rely on animation to communicate state.

## Responsive rules

- Desktop may use the wider Plan/Pool/Library/Setup measure.
- Today stays focused and narrower.
- Ledger rows stack when space is constrained.
- Modal presentation becomes sheet-like at narrow widths.
- Controls may wrap, but touch targets must not shrink below the shared minimum.

A later screen-specific milestone is still responsible for browser acceptance of the actual Day Line/Today/Held composition.

## Explicit exclusions

Gate 6B does not:

- change Today / Plan / Pool / Library navigation;
- introduce Held or global Capture;
- create the Day Line;
- implement Now / Later / Changed;
- remove capabilities from the Gate 6 capability map;
- change theme persistence or add a new theme;
- change scheduler or repair behavior;
- change task/rhythm lifecycle or recurrence;
- change Reduced Day, Minimum Done, or re-entry;
- change database schemas, migrations, dependencies, lockfiles, or workflows.
