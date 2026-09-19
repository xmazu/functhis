# hello-world

Minimal package for local CLI smoke tests. One handler (`hello.ts` at the project root, slug `hello`); package slug defaults to `hello-world` when you deploy from this directory. For multiple handlers, use a `functions/` directory (only files under it are bundled).

## Prerequisites

Repo root: `bun run dev`. For deploy, log in against local console:

```bash
functhis login --console-url http://localhost:3002 --web-url http://localhost:3001
```

See [README.md](../../README.md).

From repo root:

```bash
bun run example:hello:dev
bun run example:hello:deploy
```

Or from this directory (pass `--project-root` when using `bun run --filter @functhis/cli` from the monorepo root):

```bash
bun run --filter @functhis/cli dev -- run --slug hello --input '{"name":"Ada"}' --project-root examples/hello-world
bun run --filter @functhis/cli dev -- deploy --slug hello-world --project-root examples/hello-world --console-url http://localhost:3002 --web-url http://localhost:3001
```

## Local run (no Cloudflare)

```bash
bun run example:hello:dev
```

With JSON input:

```bash
bun packages/cli/src/cli.ts run --slug hello --input '{"name":"Ada"}' --project-root examples/hello-world
```

## Deploy

Deploy hashes the source tree, uploads the compiled bundle to KV, and records a version in Postgres. Each default export can include JSDoc (search text) and an `input` parameter whose type is stored as `contract.inputSchema` for MCP `execute`.

```bash
bun run example:hello:deploy
```

The CLI prints package and function URLs on `https://functhis.now` (or your `--web-url`).

## Execute (hosted)

After deploy:

- **HTTP:** open the printed URL or `POST` `/@owner/hello-world/hello` on web
- **MCP (local):** `bun run dev` includes `functhis-mcp` on `http://localhost:3003/mcp`. Connect MCP Inspector, complete OAuth against console (`http://localhost:3002`), then `search` (try query `greet` or `hello`) and `execute` with the returned `@handle/hello-world/hello` id
- **MCP (production):** `https://mcp.functhis.now/mcp`
