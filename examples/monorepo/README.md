# Monorepo example (Turborepo)

Small Turborepo layout: an app (`apps/demo`), shared library (`packages/shared`), and a **Functhis functions package** (`packages/demo-functions`). Only `demo-functions` is published to Functhis; the workspace root is not a deploy target.

## Layout

```text
examples/monorepo/
├── apps/demo/                 # Sample app using @acme/shared
├── packages/shared/           # Shared TS helpers
└── packages/demo-functions/   # functhis publish target (src/**/*.ts)
```

Function slugs: `greet`, `math/add`.

## Install (this example only)

From the **functhis repo root** you can use the root CLI without installing here. To exercise Turborepo tasks inside this folder:

```bash
cd examples/monorepo
bun install
bun run typecheck
bun run dev    # runs demo app watch mode
```

## Local run (no Cloudflare)

From **repo root** (recommended):

```bash
bun run example:monorepo:dev
bun run example:monorepo:dev -- --slug math/add --input '{"a":2,"b":3}'
```

Or point the CLI at the functions package:

```bash
bun packages/cli/src/cli.ts dev --slug greet --project-root examples/monorepo/packages/demo-functions
```

Do **not** pass `--project-root examples/monorepo` (workspace root); discovery will ask you to `cd` into a package.

## Publish to local stack

1. Repo root: `bun run dev` (web 3001, MCP 3003).
2. Log in against the local site:

   ```bash
   functhis login --url http://localhost:3001
   ```

   Or: `bun packages/cli/src/cli.ts login --url http://localhost:3001`

3. Publish:

   ```bash
   bun run example:monorepo:deploy
   ```

Package slug defaults to `demo-functions` (`functhis.name` in `packages/demo-functions/package.json`). After publish, use MCP at `http://localhost:3003/mcp` or the URLs printed by the CLI.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full local workflow.
