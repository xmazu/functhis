# Functhis web — visual language

> Night operator page. Near-black canvas, porcelain type, one white action. Proof lives in windows, not in decoration.

**Theme:** dark default

This file is the visual language for `apps/web` only. It records how the surface looks and feels: color, type, space, motion, and elevation. It is not a product spec, a feature list, or a component catalog.

Do not add screens, sections, widgets, or capabilities here. Those belong in code and in product docs (`vision.md`, `architecture.md`). Console visuals stay in [`apps/console/DESIGN.md`](../console/DESIGN.md).

The page should feel like a quiet instrument panel that happens to be a marketing site: one reading column, one primary action, hairlines instead of shadows, and product proof shown as a terminal or a browser chrome — never as a gallery of equal cards.

Reference lock:

- **Primary:** here.now inverted — void field, zinc-50 type, sticky frosted header, copy-first hero, 780px measure, brand-mark rules as section punctuation, porcelain pill as the only conversion color.
- **Borrow:** Linear surface stepping (void / graphite / iron) and compact chrome radius on small controls.
- **Reject:** cream editorial, Inter 300 headlines, indigo UI chrome, mesh backgrounds, three equal feature towers, serif display swaps.

## Tokens — color

| Name          | Value     | Role                                     |
| ------------- | --------- | ---------------------------------------- |
| Canvas        | `#09090b` | Page background (`zinc-950`)             |
| Porcelain     | `#fafafa` | Primary text, filled actions (`zinc-50`) |
| Body          | `#a1a1aa` | Supporting copy (`zinc-400`)             |
| Mute          | `#71717a` | Captions, chrome labels (`zinc-500`)     |
| Line          | `#27272a` | Dividers, quiet borders (`zinc-800`)     |
| Lift          | `#18181b` | Nested windows, chips (`zinc-900`)       |
| Terminal      | `#18181b` | Nested command surfaces                  |
| Terminal type | `#f4f4f5` | Type inside terminal surfaces            |
| Terminal mute | `#a1a1aa` | Secondary type inside terminal surfaces  |

Filled actions invert: porcelain fill, canvas label. Hover steps to `zinc-200`. Do not introduce chromatic tokens for chrome, links, or badges. Green is allowed only as a one-shot copy-success stroke, not as a brand accent.

Selection: porcelain wash on canvas (`porcelain` text on `porcelain/12`).

## Tokens — type

**Face:** Geist Variable (`--font-sans`). Substitute: `ui-sans-serif`, then `system-ui`.

**Mono:** `ui-monospace`, `SFMono-Regular`, `Menlo` for URLs, commands, and handles. Never as a costume on body copy.

Weights: 400 default, 500 for controls and emphasis, 600 for display and section titles. Never italic display. Never 800+.

| Role    | Size    | Line height | Tracking | Weight |
| ------- | ------- | ----------- | -------- | ------ |
| kicker  | 12px    | 1.4         | 0.1em    | 600    |
| caption | 12px    | 1.4         | 0        | 500    |
| ui      | 14px    | 1.4         | -0.01em  | 500    |
| body    | 16px    | 1.6         | -0.01em  | 400    |
| lead    | 18px    | 1.55        | -0.02em  | 400    |
| title   | 24px    | 1.2         | -0.03em  | 600    |
| section | 36–41px | 1.15        | -0.03em  | 600    |
| display | 36–48px | 1.1         | -0.04em  | 600    |

Headings use `text-wrap: balance`. Body uses `text-wrap: pretty` only on long FAQ answers. Display is left-aligned in the reading column, never centered except on a closing conversion band.

## Tokens — space and shape

**Base unit:** 4px. Density is airy: tight groups, large section gaps.

| Name           | Value     |
| -------------- | --------- |
| control gap    | 8px       |
| cluster        | 16–20px   |
| block          | 48px      |
| section        | 102–128px |
| reading column | 780px     |
| page gutter    | 24px      |

Radius:

- pills (primary copy action): `9999px`
- compact chrome (log in / sign up): `6px`
- windows and panels: `12px`
- highlight well around a single hero word: `8px`

Elevation comes from surface steps (`#09090b` → `#18181b` → `#27272a`) and hairlines, not drop shadows. A window may use a single tight dark shadow. Do not stack cards inside cards.

## Layout

One reading column (`max-w-[780px]`) on a full-bleed void canvas. The first viewport is copy-led: large display type, then the primary action, then a quiet proof strip. Later bands keep the same column; full-bleed rails are allowed only when the content is a horizontal set that must escape the measure.

Header is sticky, full-width, frosted (`bg-zinc-950/70`, blur, saturate). It does not become an island.

Section punctuation is a hairline rule interrupted by the brand mark — not a numbered kicker, not a colored slab.

Do not hide the primary action below `md`. Do not pin scroll theaters on this surface.

## Motion

Sparse and interruptible. Shared timing:

- 120ms color/hover
- 180ms expand/collapse
- 300ms copy-state crossfade
- 315ms opacity / 700ms translate on section reveal
- easing: `cubic-bezier(0.16, 1, 0.3, 1)` for reveals; `ease-out` for local UI

Press scale on pills: `0.96`. Copy success is an icon crossfade, never a toast. Disable transform and delay under `prefers-reduced-motion: reduce`; show the completed state.

`html, body { overflow-anchor: none; }` so enter transforms cannot park the scroll.

## Surfaces

| Level | Value                | Purpose                              |
| ----- | -------------------- | ------------------------------------ |
| 0     | `#09090b`            | Page                                 |
| 1     | `#18181b`            | Nested windows, chips, command proof |
| 2     | `#27272a`            | Highlight wells, selected chrome     |
| 3     | `#18181b` + hairline | Browser-window proof                 |

Window chrome uses three 10px dots (structure, not brand color) and mono URL text. Product proof may be a command surface or a lifted browser frame. Do not mock IDEs. Do not drop a white paper card onto the void.

## Imagery

No photography on this surface. No mesh, no spheres, no stock devices. Marks are monochrome and inherit porcelain. Agent and tool names are wordmarks or simple geometric glyphs at one optical size, never vendor-color logos. Missing assets stay empty — do not fake a screenshot with stacked gray bars pretending to be a photo.

## Do

- Keep the canvas near-black and the type porcelain.
- Use one filled porcelain pill as the conversion action.
- Put the offer in the headline; do not add an eyebrow above it.
- Prove the product with a command and a URL, not with adjectives.
- Leave more space between sections than inside a cluster.

## Don't

- Do not switch this surface to white, cream, or a colored wash.
- Do not use indigo, violet, ember, or lime on chrome.
- Do not add page-wide gradients or glass as decoration.
- Do not catalog features, flows, or components in this file.
- Do not restyle `apps/console` or `packages/ui` from this language.
