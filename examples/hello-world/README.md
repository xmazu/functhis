# hello-world

Minimal package for local CLI smoke tests. One handler (`hello.ts` at the project root, slug `hello`); package slug defaults to `hello-world` when you deploy from this directory. For multiple handlers, use a `functions/` directory (only files under it are bundled).

## Prerequisites

Repo root: `bun run dev` and CLI logged in (`functhis login`). See [README.md](../../README.md).

From repo root:

```bash
bun run example:hello:dev
bun run example:hello:deploy
```

Or from this directory (pass `--project-root` when using `bun run --filter @functhis/cli` from the monorepo root):

```bash
bun run --filter @functhis/cli dev -- dev --slug hello --project-root examples/hello-world
bun run --filter @functhis/cli dev -- deploy --slug hello-world --project-root examples/hello-world
```

## Local run (no Cloudflare)

```bash
bun run example:hello:dev
```

## Deploy

Deploy hashes the source tree, uploads the compiled bundle to KV, and records a version in Postgres.

```bash
bun run example:hello:deploy
```

## Execute

With runtime dev running (`bun run --filter @functhis/runtime-worker dev:bare` from repo root):

```bash
curl -sS -X POST http://localhost:3001/api/deploy/execute \
  -H "Authorization: Bearer $(jq -r .accessToken ~/.config/functhis/config.json)" \
  -H 'content-type: application/json' \
  -d '{"versionId":"<from deploy>","functionSlug":"hello","input":{"name":"functhis"}}'
```
