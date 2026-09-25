# functhis

Publish TypeScript functions to [Functhis](https://functhis.now).

## Install

```bash
npx functhis
bunx functhis
npm install -g functhis
```

Requires Node 20+.

## Commands

```bash
functhis login
functhis publish --slug my-package --project-root .
functhis rollback 1.0.0
functhis run --slug my-function --input '{"name":"Ada"}'
```

`run` and `dev` are aliases for local execution against your package (`src/`, `functions/`, or `"functhis.root"`).

Production defaults:

- Console (OAuth): `https://functhis.now` (same origin as the site; device flow at `/device`)
- Web / publish API: `https://functhis.now`

Override with `--console-url` / `--web-url`, or `FUNCTHIS_CONSOLE_URL` / `FUNCTHIS_WEB_URL`.

After `functhis login`, tokens are stored in `~/.config/functhis/config.json`.

## Monorepo development

From the [functhis](https://github.com/openenvx/functhis) repository:

```bash
bun run --filter functhis dev -- login
bun run --filter functhis build
```
