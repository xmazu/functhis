# Console design

Native desktop owner app. Compact, dark, system chrome. Not marketing.

Product role lives in [architecture.md](../../architecture.md). This file is the visual system for `apps/console` only. Do not restyle `apps/web` or `packages/ui`.

## Look

Forced dark. Near-black canvas, 4% white hairlines, system UI at 12px with normal tracking, frosted sidebar, opaque inset content, flat controls. No drop shadows. Rows ~28px.

Reject Inter, Geist, Cal Sans, lyra `rounded-none`, marketing hero type, and fake product surfaces (Projects, Threads, Kanban, Terminal).

## Tokens

Source of truth: [`src/index.css`](src/index.css). Root is forced `.dark` on `<html>`. Light `:root` values exist for the stylesheet; the product does not ship a theme toggle.

| Token | Dark value |
| --- | --- |
| `--background` | `#0e0e0e` |
| `--border` / `--secondary` / `--muted` / `--accent` | `white / 4%` |
| `--input` | `white / 5%` |
| `--seam-line` | `white / 5%` |
| `--app-sidebar-surface` | charcoal glass ~72% over black |
| `--app-sidebar-backdrop-filter` | `blur(4px) saturate(130%)` |
| `--font-ui-family` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui` |
| `--app-font-size-ui` | `12px` |
| `--app-density-row-height` | `1.75rem` |

`--font-sans` and `--font-heading` map to `--font-ui-family`. Body `letter-spacing: normal` so SF Pro on macOS reads native.

Do not run `@coss/style` (it installs Inter + Geist). Overlay Functhis tokens on coss primitives instead.

## Type

One size for UI copy: `text-[length:var(--app-font-size-ui,12px)]`. Weight `400` for body, `500` for titles and selected nav. Device codes use `font-mono tracking-widest`.

Sentence case. Verb-first buttons: Continue with GitHub, Look up code, Approve device, Allow, Deny, Sign out.

## Chrome

Signed-in routes under `/_auth` use `AppShell`: frosted rail + opaque inset card.

```text
[ Functhis          ] [ Home                          ]
[ Home              ] [ Signed in as …                ]
[ Authorize device  ] [ later-phase copy              ]
[ name              ]
[ Sign out          ]
```

- Sidebar: `app-sidebar-surface`, 28px rows, muted hover, `--sidebar-selected` for the active item
- Content: `app-content-card` with `inset 0.5px` hairline (`--seam-line`)
- Nav is honest: Home → `/`, Packages → `/packages`, Authorize device → `/device`. User name + ghost Sign out at the bottom
- `md` and up: persistent rail. Below `md`: sheet from the hamburger

Login, device, and consent stay **outside** `/_auth`. Wrap them in `AuthCanvas`: full-bleed `#0e0e0e`, small Functhis wordmark (link home only when a session exists), compact hairline card. No sidebar.

## Components

Kit lives in [`src/components/ui`](src/components/ui). Registry: [`components.json`](components.json) (`base-rhea`, Tabler, `default-translucent`, `@coss` → `https://coss.com/ui/r/{name}.json`).

Add a primitive from `apps/console`:

```bash
bunx --bun shadcn@latest add @coss/<name>
```

Then flatten stock coss elevation (inset/drop shadows) to hairlines + 4% fills, and force 12px system type. Convert CLI `function` output to arrows (`func-style`). Do not `add @coss/ui` (whole kit) and do not `add @coss/style`.

Pages import `@/components/ui/...` only. The one exception is `Toaster` from `@functhis/ui/components/sonner` until `@coss/toast` exists.

Icons: `@tabler/icons-react`. One library on this surface.

### Controls

| Role               | Treatment                                     |
| ------------------ | --------------------------------------------- |
| Primary            | `Button` default, `h-8`, flat fill, no shadow |
| Secondary          | `outline`                                     |
| Destructive / deny | `destructive-outline`, not a loud red fill    |
| Sign out / quiet   | `ghost`                                       |
| Card               | hairline + `bg-card` only                     |
| Input              | denser field, `--input` fill                  |

Prefer existing variants over new ones. Overlay tokens in CSS; do not fork a second button kit.

## Layout files

| File | Role |
| --- | --- |
| [`src/components/app-shell.tsx`](src/components/app-shell.tsx) | Signed-in shell |
| [`src/components/app-sidebar.tsx`](src/components/app-sidebar.tsx) | Rail + mobile sheet |
| [`src/components/auth-canvas.tsx`](src/components/auth-canvas.tsx) | Unauth / device / consent frame |
| [`src/routes/__root.tsx`](src/routes/__root.tsx) | `className="dark"`, toaster, no global header |
| [`src/routes/_auth/route.tsx`](src/routes/_auth/route.tsx) | Session gate + `AppShell` |
| [`src/lib/utils.ts`](src/lib/utils.ts) | `cn` |

## Do not

- Import `@functhis/ui/components/*` except `sonner`
- Restyle `packages/ui` or `apps/web` to match this look
- Invent nav items the product does not have yet
- Add a light-mode toggle, command palette, or density settings
- Load Inter / Geist / Cal Sans
- Name other products in comments, identifiers, or notices
