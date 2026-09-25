# functhis

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Self, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Web UI kit** - shadcn/coss primitives live in `apps/web/src/components/ui`
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Drizzle** - TypeScript-first ORM
- **Neon Postgres + Hyperdrive** - Database engine
- **Authentication** - Better Auth on `apps/web` (OAuth issuer at `functhis.now`)
- **Husky** - Git hooks for code quality
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Turborepo** - Optimized monorepo build system

Contributors: see [CONTRIBUTING.md](CONTRIBUTING.md) for tests, examples, and publish-to-local in one place.

## Run locally

### Prerequisites

- [Bun](https://bun.sh) (see root `packageManager`)
- [Docker](https://www.docker.com/) for local Postgres (recommended), or Neon unpooled URL if you prefer remote DB
- GitHub OAuth app for login (see below)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in (`wrangler login`) only when creating Hyperdrive for **deployed** Workers

### 1. Install

```bash
bun install
```

### 2. Local Postgres (Docker)

```bash
docker compose up -d
cp packages/db/.env.example packages/db/.env
```

**`packages/db/.env`** - one URL for migrations **and** local dev (no separate Hyperdrive export):

```bash
DATABASE_URL=postgres://functhis:functhis@localhost:5432/functhis
```

`bun run dev` reads this file and wires the Worker `HYPERDRIVE` binding to the same URL locally. Hyperdrive service itself is **not** used on your machine.

### 3. App secrets

**`apps/web/.env`** - OAuth + site (see [`apps/web/.env.schema`](apps/web/.env.schema)):

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3001
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TRUSTED_ORIGINS=http://localhost:3001,http://localhost:3003
```

After editing any `.env.schema`, regenerate types:

```bash
bun run env:generate
```

### 4. GitHub OAuth app

Create a GitHub OAuth app (Settings → Developer settings → OAuth Apps):

| Field | Value |
| --- | --- |
| Homepage URL | `http://localhost:3001` |
| Authorization callback URL | `http://localhost:3001/api/auth/callback/github` |

Copy the client ID and secret into `apps/web/.env`.

### 5. Database migrations

```bash
bun run db:migrate:local
```

After schema changes:

```bash
bun run db:generate
bun run db:migrate:local
```

**Squashed migrations:** If a database already applied older Drizzle migrations (`0000_silly_red_wolf` … `0002_funny_wolverine`, or `0000_crazy_johnny_storm`), reset that branch or recreate the database before applying the current single `0000_large_harrier` migration. Greenfield local Docker is unaffected.

### 6. Start dev servers

```bash
bun run dev
```

| App | URL | Role |
| --- | --- | --- |
| Web | [http://localhost:3001](http://localhost:3001) | Marketing, OAuth, `/d` owner UI, deploy API |
| MCP | [http://localhost:3003](http://localhost:3003) | MCP `search` / `execute` (local) |

### CLI

Install from npm (`npx functhis`, `bunx functhis`, or `npm i -g functhis`), or from the monorepo after `bun run --filter functhis build`:

For agent-guided authoring, install the Functhis skill in your project:

```bash
npx skills add xmazu/functhis@functhis-function-authoring -y
```

The skill teaches compatible agents how to shape, author, verify, publish, connect, evolve, and roll back Functhis functions while keeping publishing and other external actions under the developer's control.

For TypeScript when you use `import from 'functhis:runtime'`, add `functhis` as a dev dependency and `/// <reference types="functhis" />` in a `.d.ts` file your tsconfig includes. See [packages/cli/README.md](packages/cli/README.md).

```bash
functhis login
functhis publish
functhis run --slug my-function --input '{"name":"Ada"}'
```

Monorepo without building: `bun packages/cli/src/cli.ts login`

Production defaults: `https://functhis.now` for login and publish. Override with `--url` or `FUNCTHIS_URL`.

Local deploy against `bun run dev`:

```bash
functhis login --url http://localhost:3001
bun run example:hello:deploy
```

`functhis publish` builds a self-contained artifact locally, stores it on R2 (canonical) and KV (hot path), records an immutable semver, and prints live `@scope/package/function` URLs and MCP ids (packages default to **private** unless you set `--visibility`).

**Maintainers — ship the npm CLI:** manual workflow [Release](.github/workflows/release.yml) (`workflow_dispatch` on `main`). Add repository secret **`NPM_TOKEN`** (npm publish access for `functhis`). Steps, retries, and provenance: [PUBLISHING.md](PUBLISHING.md).

Web only:

```bash
bun run dev:web   # port 3001 (site, OAuth, /d, publish API)
```

Optional: both Workers in one Wrangler dev session (exercises Hyperdrive bindings when configured):

```bash
bun run --filter @functhis/infra dev:workers
```

### 7. Verify

- Open [http://localhost:3001/login](http://localhost:3001/login) and sign in with GitHub
- Run `bun run check-types` and `bun run check` before pushing

## Production database (Neon + Hyperdrive)

Local Docker is enough for day-to-day dev. Deployed Workers use Neon through Hyperdrive (auth: cache disabled on web; catalog: cache enabled on mcp).

1. Set `DATABASE_URL` in `packages/db/.env` to your Neon **direct** (unpooled) URL when running migrations against remote.
2. Provision Cloudflare resources with Terraform in `packages/infra` (see **Deployment** below). Paste `hyperdrive_auth_id`, `hyperdrive_catalog_id`, `kv_bundles_namespace_id`, `kv_hot_namespace_id`, and `secrets_store_id` from `terraform output` into `apps/web/wrangler.jsonc` and `apps/mcp/wrangler.jsonc` before deploy.

Auth queries must not use a cached Hyperdrive config on the web Worker.

## Database (reference)

Postgres + Drizzle. Local: Docker + `packages/db/.env` `DATABASE_URL`. Production runtime: `env.HYPERDRIVE.connectionString`. Migrations always use `DATABASE_URL` from `packages/db/.env`, never through Hyperdrive.

## UI Customization

Marketing and owner UI share shadcn/coss primitives in `apps/web/src/components/ui`.

- Dashboard tokens and surfaces: `apps/web/src/routes/d/surface.css`
- Marketing layout and motion: `apps/web/src/index.css`
- Shared shadcn theme baseline: `apps/web/src/styles/globals.css`
- Registry and aliases: `apps/web/components.json` (`@coss` → `https://coss.com/ui/r/{name}.json`)

### Add more components

From `apps/web`:

```bash
bunx --bun shadcn@latest add @coss/<name>
```

Import shared components like this:

```tsx
import { Button } from '#/components/ui/button';
```

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` on `bun install` and via `bun run env:generate`. Commit schemas; keep secrets in ignored `.env` files.

| Package | `.env` path | Purpose |
| --- | --- | --- |
| `packages/db` | `packages/db/.env` | `DATABASE_URL` - migrations + local dev DB |
| `apps/web` | `apps/web/.env` | Better Auth + GitHub OAuth |

Worker bindings (`HYPERDRIVE`, etc.) come from Wrangler, not Varlock. Local dev reads `packages/db/.env` automatically via `scripts/run-with-local-database-url.ts` - no manual `CLOUDFLARE_HYPERDRIVE_*` export.

CIMD metadata fetch runs on the **web** Worker. `apps/web/wrangler.jsonc` sets `global_fetch_strictly_public` so `fetch()` blocks private targets after DNS; `packages/auth` also validates HTTPS URLs before fetch. Regenerate Worker types after Wrangler changes: `bun run cf-typegen` (also runs on `bun install`).

See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

## Deployment

Terraform in [`packages/infra`](packages/infra) owns account-level Cloudflare resources. Wrangler deploys first-party Worker code. See [architecture.md](architecture.md).

**Prerequisites:** [Terraform](https://www.terraform.io/) CLI, `CLOUDFLARE_API_TOKEN`, Neon **direct** URL, GitHub OAuth app (production callback `https://functhis.now/api/auth/callback/github`).

**Production:**

```bash
cd packages/infra
cp production.tfvars.example production.tfvars

bun run tf:production
```

Terraform keeps local state in `packages/infra/production.tfstate`. It is ignored by Git; back it up securely because it contains infrastructure details and database connection data.

After apply: paste Hyperdrive, KV, and Secrets Store IDs into the Wrangler `production` env blocks, then deploy Workers in order - **`functhis-mcp` first** (MCP host must serve traffic before Terraform routes `mcp.*`), then web. Only after MCP is live, set `enable_domains = true` in tfvars and apply again for custom domains.

**Web only** (site, OAuth, `/d`, deploy API; TanStack Start via `@cloudflare/vite-plugin`):

```bash
wrangler login   # once per machine
bun run deploy:web:production
```

**Both Workers** (MCP first, then web):

```bash
bun run deploy:production
```

Those scripts set `CLOUDFLARE_ENV` during `vite build` so the generated Worker config matches the target environment, then run `wrangler deploy` from `apps/web`. Do not deploy web with `wrangler deploy -c apps/web/wrangler.jsonc` from another directory without building first - Wrangler will try to rebundle `worker-entry.ts` and fail.

**GitHub Actions:** workflow [Deploy web](.github/workflows/deploy-web.yml) (`workflow_dispatch`). Add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit) and `CLOUDFLARE_ACCOUNT_ID`.

- Workers: `functhis-web` + `functhis-mcp` (MCP + Dynamic Workers LOADER)
- Auth issuer: `https://functhis.now`
- Dev: `bun run dev` (web 3001 + MCP 3003)
- Migrations: `bun run db:migrate:local` (Neon direct URL; never through Hyperdrive)

Do not create customer packages or dispatch namespaces in Terraform. Package deploys go through the deploy API: source hash, KV bundle, Postgres version row.

### Alpha smoke (CLI deploy + execute)

Use the repo example package [`examples/hello-world`](examples/hello-world) (see [examples/README.md](examples/README.md)).

1. Start stack: `bun run dev` (web 3001 + MCP 3003).
2. Log in: `bun packages/cli/src/cli.ts login --url http://localhost:3001` (device flow against the site; tokens in `~/.config/functhis/config.json`).
3. `bun run example:hello:dev` then `bun run example:hello:deploy` (see [`examples/hello-world`](examples/hello-world)).
4. Hosted execute: MCP `search` / `execute` at `http://localhost:3003/mcp` (OAuth via http://localhost:3001).
5. Deploy again for v2; rollback by updating `package.currentVersionId` in Postgres to the prior version id (no rebuild if that version’s KV key still exists).

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`
- Run checks: `bun run check`

## Project Structure

```
functhis/
├── examples/
│   ├── hello-world/ # Minimal publish smoke test
│   └── monorepo/    # Turborepo + functions package
├── apps/
│   ├── web/         # Site, OAuth issuer, /d owner UI, deploy API (functhis.now)
│   └── mcp/         # mcp.functhis.now - MCP + Dynamic Workers
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # Shared oRPC / business logic (multi-app only)
│   ├── auth/        # createAuth, CIMD fetch, CLI client seed, deploy bearer
│   ├── cli/         # functhis login, deploy, run/dev
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start web (3001) and MCP (3003) in parallel
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application (port 3001)
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:types`: Watch API declarations when running an app individually
- `bun run db:generate`: Generate Drizzle migrations from schema
- `bun run db:migrate:local`: Apply Drizzle migrations to Neon
- `bun run example:hello:dev`: Run [`examples/hello-world`](examples/hello-world) locally (no Cloudflare)
- `bun run example:hello:deploy`: Deploy hello-world via CLI (passes localhost URL; log in with `functhis login --url http://localhost:3001` first)
- `bun run example:monorepo:dev` / `example:monorepo:deploy`: Turborepo example (`packages/demo-functions`)
- `bun run check`: Run Oxlint and Oxfmt
