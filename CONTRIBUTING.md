# Contributing

How to run the platform locally, run tests, and try the example packages (including publish against your machine).

## Prerequisites

- [Bun](https://bun.sh) (see root `packageManager`)
- [Docker](https://www.docker.com/) for local Postgres (recommended)
- GitHub OAuth app for login ([README.md](./README.md#4-github-oauth-app))
- Optional: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in for deployed Workers / Terraform

## One-time setup

```bash
bun install
docker compose up -d
cp packages/db/.env.example packages/db/.env   # if missing
# apps/web/.env — BETTER_AUTH_* + GitHub OAuth (see README)
bun run db:migrate:local
```

## Run the platform locally

```bash
bun run dev
```

| Service                              | URL                   |
| ------------------------------------ | --------------------- |
| Web (site, OAuth, `/d`, publish API) | http://localhost:3001 |
| MCP (`search` / `execute`)           | http://localhost:3003 |

Web only:

```bash
bun run dev:web
```

Sign in at http://localhost:3001/login to exercise OAuth flows.

## Test everything

| Layer | Command | What it covers |
| --- | --- | --- |
| Lint + types + knip | `bun run check` | Oxlint, Oxfmt, env codegen, unused exports |
| Typecheck | `bun run check-types` | TypeScript across workspaces |
| Unit | `bun run test` | Auth, CLI, publish helpers, MCP edges |
| Integration (Postgres) | `bun run test:integration` | Publish start/finalize/rollback against real DB |

Pre-push habit (also wired in Husky where configured):

```bash
bun run check && bun run check-types && bun run test
```

Integration details: [docs/integration-tests.md](docs/integration-tests.md) and [tests/integration/README.md](tests/integration/README.md).

## CLI during development

Without a global install, run the workspace CLI:

```bash
bun packages/cli/src/cli.ts login --url http://localhost:3001
bun packages/cli/src/cli.ts publish --help
```

Tokens are stored in `~/.config/functhis/config.json`.

## Example packages

Examples live under [`examples/`](examples/). They are **not** part of the root Bun workspace; you always pass `--project-root` to the package directory (or use the root scripts below).

| Example | Publish target path | Root scripts |
| --- | --- | --- |
| [hello-world](examples/hello-world/) | `examples/hello-world` | `example:hello:dev`, `example:hello:deploy` |
| [monorepo](examples/monorepo/) | `examples/monorepo/packages/demo-functions` | `example:monorepo:dev`, `example:monorepo:deploy` |

### hello-world (minimal)

```bash
bun run dev   # in another terminal
functhis login --url http://localhost:3001
bun run example:hello:dev
bun run example:hello:deploy
```

### monorepo (Turborepo + shared package)

Optional: install example workspaces only:

```bash
cd examples/monorepo && bun install && bun run typecheck
```

Publish and run from repo root:

```bash
bun run example:monorepo:dev
bun run example:monorepo:deploy
```

Use `--project-root examples/monorepo/packages/demo-functions` (not the Turborepo root). Workspace roots with no handlers return _cd into a package_ from the CLI.

### After publish (local)

- CLI prints MCP ids (`@handle/package/function`).
- MCP: connect to `http://localhost:3003/mcp`, OAuth via http://localhost:3001, then `search` / `execute`.
- Run a handler locally anytime: `functhis run --slug … --project-root …` (no deploy).

More author rules: [examples/README.md](examples/README.md).

## Code style

- Format/lint: `bun x ultracite fix` / `bun run check`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — see [AGENTS.md](AGENTS.md)

## Where to read more

- Product / architecture: [vision.md](vision.md), [architecture.md](architecture.md)
- Local stack details: [README.md](README.md#run-locally)
- Publishing model: [PUBLISHING.md](PUBLISHING.md)
