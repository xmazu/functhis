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

Production default: `https://functhis.now` (OAuth + publish API; device flow at `/device`).

Override with `--url` or `FUNCTHIS_URL` (local: `http://localhost:3001`).

After `functhis login`, tokens are stored in `~/.config/functhis/config.json`.

## Monorepo development

From the [functhis](https://github.com/openenvx/functhis) repository:

```bash
bun packages/cli/src/cli.ts login
bun run --filter functhis build
```
