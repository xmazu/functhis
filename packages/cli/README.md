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

## Calling your app (Next.js)

When a published function needs your database or other app-only APIs, keep that work in your Next.js app and expose a small HTTP endpoint. Install `functhis` as a production dependency in the app.

Define handlers in a module (not in `route.ts`):

```ts
import { createHandler } from 'functhis/sdk/next';

export const api = createHandler({
  token: process.env.FUNCTHIS_TOKEN,
  functions: {
    'list-weddings': async (input: ListWeddingsInput) => ({
      weddings: await searchEventsForAdmin(input),
    }),
  },
});

export type Api = typeof api;
```

Mount the handler:

```ts
// app/api/functhis/[[...slug]]/route.ts
import { api } from '@/lib/functhis-api';

export const runtime = 'nodejs';

export const { GET, POST } = api;
```

`functhis/sdk/next` uses Node APIs for bearer-token verification. Use the Node.js runtime for this route (not Edge).

Mount the route at `/api/functhis` on the app origin (no `basePath` prefix on that URL). If your app uses Next.js `basePath`, expose this handler on a host or path where requests reach `/api/functhis/...` as documented above.

In the function package, call the app with the typed client. Use `import type` for `Api` so database code is not bundled into the published function:

```ts
import { createClient } from 'functhis/sdk/client';
import type { Api } from '../lib/functhis-api';

const app = createClient<Api>({
  url: 'https://your-app.example.com',
  token: 'same-value-as-FUNCTHIS_TOKEN',
});

export default async function listWeddings(input: ListWeddingsInput) {
  return app['list-weddings'](input);
}
```

A hardcoded `token` is stored in the published bundle. Keep the package private and rotate the token when you move to hosted secrets.

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

Releases are cut from GitHub Actions on `xmazu/functhis` — see [PUBLISHING.md](https://github.com/xmazu/functhis/blob/main/PUBLISHING.md) in the monorepo root.

## Monorepo development

From the [functhis](https://github.com/xmazu/functhis) repository:

```bash
bun packages/cli/src/cli.ts login
bun run --filter functhis build
```
