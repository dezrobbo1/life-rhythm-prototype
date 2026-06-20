# Life Rhythm Theme System Contract

Status: Design contract
Scope: Theme architecture, semantic tokens, accessibility modifiers, and theme UX
Source basis: Applied ADHD UX/UI research, current design boards, Life Rhythm design spec, and source packets

## 1. Purpose

Life Rhythm should support multiple themes without becoming visually chaotic, generic, or distracting.

Themes should help users tune brightness, contrast, warmth, and stimulation. They should not create unrelated product worlds or make appearance selection another task to manage.

## 2. Theme principles

Themes must preserve:

- product identity
- object grammar
- navigation structure
- spacing scale
- typography scale
- surface hierarchy
- state labels
- time-edge meaning
- reduced-motion behaviour
- accessibility requirements

Themes may vary:

- page warmth/coolness
- surface tint
- accent hue
- day-band fills
- protected/open-capacity fills
- low-emphasis colour
- dark/light environment

Themes must not vary:

- what a state means
- which object is dominant
- whether colour is the only status cue
- navigation labels
- product language
- copy tone
- radius/shadow hierarchy

## 3. Recommended prototype theme set

Ship four base themes first:

1. **Paper** — default warm neutral theme.
2. **Tide** — blue-green calm theme.
3. **Clay** — earth/warm grounded theme.
4. **Night** — low-light dark theme.

Add two cross-theme modifiers:

1. **High Contrast Calm** — increases contrast without alarm styling.
2. **Reduced Stimulation** — lowers saturation, removes decorative colour emphasis, and reduces non-essential visual texture.

Do not ship many equal themes at first. More than four base themes risks turning theme selection into a task.

## 4. Theme naming rules

Use material/place-like names rather than mood or productivity names.

Allowed naming direction:

- Paper
- Tide
- Clay
- Night
- Forest, later if needed

Avoid names like:

- Focus
- Productivity
- Energy
- Dopamine
- Success
- Calm Pro
- AI Blue
- Ultra Minimal
- Motivation
- Recovery Mode

Theme names should feel descriptive, not prescriptive.

## 5. Core semantic token model

Use semantic tokens. Do not hard-code theme colours into components.

Core background tokens:

- `bg.page`
- `bg.surface`
- `bg.tray`
- `bg.band.open`
- `bg.band.protected`
- `bg.band.askFirst`
- `bg.band.recovery`
- `bg.sheet`
- `bg.input`

Core foreground tokens:

- `fg.primary`
- `fg.secondary`
- `fg.muted`
- `fg.disabled`
- `fg.inverse`

Stroke tokens:

- `stroke.soft`
- `stroke.strong`
- `stroke.focus`
- `stroke.timeSoft`
- `stroke.timeFirm`

Accent tokens:

- `accent.focus`
- `accent.quiet`
- `accent.safe`
- `accent.notice`
- `accent.timeSoft`
- `accent.timeFirm`
- `accent.archived`

Action tokens:

- `action.primary.bg`
- `action.primary.fg`
- `action.secondary.bg`
- `action.secondary.fg`
- `action.quiet.fg`
- `action.destructive.bg`
- `action.destructive.fg`

Surface role tokens:

- `surface.primaryObject`
- `surface.ledgerRow`
- `surface.tray`
- `surface.dayBand`
- `surface.sheet`

## 6. Base theme intent

### Paper

Default theme.

Should feel:

- warm
- clear
- private
- paper-adjacent without skeuomorphism
- low-stimulation

Use for baseline design decisions.

### Tide

Should feel:

- cool
- spacious
- steady
- soft but not pastel-generic

Good for users who prefer blue-green calm.

### Clay

Should feel:

- grounded
- warm
- tactile
- mature

Good for users who dislike blue/productivity palettes.

### Night

Should feel:

- low-light
- quiet
- readable
- not black-on-grey mud

Night must still preserve object hierarchy and visible states.

## 7. Accessibility modifiers

### High Contrast Calm

High Contrast Calm is not a separate aesthetic theme. It is a modifier.

It should:

- increase text contrast
- firm up borders
- improve focus rings
- clarify day-band edges
- preserve calm colour language

It should not:

- turn time edges red by default
- add warning-heavy styling
- make the app look clinical
- introduce harsh neon contrast unless required by user settings

### Reduced Stimulation

Reduced Stimulation is also a modifier.

It should:

- reduce colour saturation
- reduce decorative fills
- reduce shadow depth
- simplify background tinting
- remove optional illustration/texture
- keep hierarchy through spacing, text, and rules

It should not:

- hide important state
- lower contrast below accessibility requirements
- remove all visual hierarchy

## 8. Status colour rules

Never use colour alone to communicate state.

Every state must also have:

- plain text label
- placement/context
- shape, rule, or object treatment when necessary

State colour rules:

- safe/held states use quiet safe accents
- notice states use restrained notice accents
- archived/no-longer-needed uses muted archived accents
- destructive actions use destructive colour only when truly destructive

Do not use red for:

- due-by
- useful-until
- not today
- parked
- deferred
- no longer needed
- missed or disrupted states

Red is reserved for true destructive or unsafe actions.

## 9. Time-edge colour rules

Time edges should use text and structure before colour.

Order of salience:

1. wording
2. position/edge treatment
3. stroke or marker
4. restrained colour

Recommended mapping:

- `dueBy`: end-cap rule + `accent.timeFirm`
- `fixedAt`: pinned point + `accent.timeFirm`
- `usefulUntil`: fading edge + `accent.timeSoft`
- `latestUsefulStart`: pre-edge marker + `accent.timeSoft`
- `minimumStillHelps`: supportive text line + no alarm colour
- `noLongerNeeded`: archived accent, not destructive colour

Avoid:

- overdue red chips
- pulsing borders
- countdown alarms
- exclamation icons by default
- urgency gradients

## 10. Day-shape colour rules

Open capacity and protected time must be visually distinct but calm.

Open capacity:

- use `bg.band.open`
- appears possible, not guaranteed
- should include text such as “Open capacity” or “Possible planning space”

Protected time:

- use `bg.band.protected`
- visually firmer or more ruled than open capacity
- should include text such as “Protected” or “Leave alone”

Ask-first blocks:

- use `bg.band.askFirst`
- indicate conditional availability
- never appear as empty task space

Recovery time:

- use `bg.band.recovery`
- should feel unavailable or low-demand unless explicitly changed by user

## 11. Theme selection UX

Theme selection should be simple by default.

Settings should show:

- current theme
- four base theme previews
- one sentence per theme
- follow system light/dark option if available
- advanced accessibility modifiers under “Ease and visibility” or similar

Do not show:

- large theme marketplaces
- daily theme prompts
- gamified unlocks
- seasonal novelty by default
- theme scoring
- random theme selection

Theme selection should not interrupt onboarding unless required for readability.

## 12. Prototype implementation order

Implement in this order:

1. semantic tokens
2. Paper theme
3. Night theme
4. Tide and Clay themes
5. High Contrast Calm modifier
6. Reduced Stimulation modifier
7. theme preview UI
8. later optional Forest theme if testing supports it

## 13. Component obligations

Components must consume semantic tokens. A component should not know whether it is in Paper, Tide, Clay, or Night.

Allowed component references:

- `surface.primaryObject`
- `surface.ledgerRow`
- `surface.tray`
- `surface.dayBand`
- `fg.primary`
- `fg.secondary`
- `stroke.soft`
- `accent.timeSoft`

Avoid raw theme names inside component styling except in theme definition files.

## 14. Theme testing checklist

For each theme and modifier combination, verify:

- Today next action remains dominant
- Pool rows remain readable
- Plan open/protected bands remain distinct
- useful windows remain visible without alarm styling
- navigation selected state is clear
- focus states remain visible
- disabled states remain readable enough
- no status depends on colour alone
- text contrast meets accessibility expectations
- reduced-motion and reduced-stimulation rules are respected

## 15. Non-goals

This contract does not approve:

- decorative theme marketplace
- AI-generated theme suggestions
- seasonal gamified themes
- mood-tracking themes
- productivity-mode themes
- arbitrary user colour pickers in prototype
- custom typography per theme
- per-screen theme overrides
