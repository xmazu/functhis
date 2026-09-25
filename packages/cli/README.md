# functhis

Publish TypeScript functions to [Functhis](https://functhis.now).

## Install

```bash
npx functhis
bunx functhis
npm install -g functhis
```

Requires Node 20+.

`npx functhis` and global install run the CLI only. For editor types when you import `functhis:runtime`, add the package as a dev dependency in your function project:

```bash
npm install -D functhis
```

Add a file your `tsconfig.json` already includes (for example `src/functhis.d.ts`):

```ts
/// <reference types="functhis" />
```

Then optional runtime imports type-check:

```ts
import { context, secret } from 'functhis:runtime';
```

At publish time the CLI externalizes that import; the host injects the real module. The reference file is types only.

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

## Publishing (maintainers)

Releases are cut from GitHub Actions on `openenvx/functhis` — see [PUBLISHING.md](https://github.com/openenvx/functhis/blob/main/PUBLISHING.md) in the monorepo root.

## Monorepo development

From the [functhis](https://github.com/openenvx/functhis) repository:

```bash
bun packages/cli/src/cli.ts login
bun run --filter functhis build
```
