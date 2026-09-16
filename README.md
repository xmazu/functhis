# functhis

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Self, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Drizzle** - TypeScript-first ORM
- **Neon Postgres + Hyperdrive** - Database engine
- **Authentication** - Better Auth on `apps/console` (OAuth issuer)
- **Husky** - Git hooks for code quality
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Turborepo** - Optimized monorepo build system

## Run locally

### Prerequisites

- [Bun](https://bun.sh) (see root `packageManager`)
- [Docker](https://www.docker.com/) for local Postgres (recommended), or Neon unpooled URL if you prefer remote DB
- GitHub OAuth app for console login (see below)
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

**`packages/db/.env`** — one URL for migrations **and** local dev (no separate Hyperdrive export):

```bash
DATABASE_URL=postgres://functhis:functhis@localhost:5432/functhis
```

`bun run dev` reads this file and wires the Worker `HYPERDRIVE` binding to the same URL locally. Hyperdrive service itself is **not** used on your machine.

### 3. App secrets

**`apps/console/.env`** — OAuth issuer:

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3002
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TRUSTED_ORIGINS=http://localhost:3002,http://localhost:3001
```

**`apps/web/.env`** — optional; defaults in `.env.schema` are enough for local dev:

```bash
CONSOLE_URL=http://localhost:3002
```

After editing any `.env.schema`, regenerate types:

```bash
bun run env:generate
```

### 4. GitHub OAuth app

Create a GitHub OAuth app (Settings → Developer settings → OAuth Apps):

| Field | Value |
| --- | --- |
| Homepage URL | `http://localhost:3002` |
| Authorization callback URL | `http://localhost:3002/api/auth/callback/github` |

Copy the client ID and secret into `apps/console/.env`.

### 5. Database migrations

```bash
bun run db:migrate:local
```

After schema changes:

```bash
bun run db:generate
bun run db:migrate:local
```

**Squashed migrations:** If a database already applied older Drizzle migrations (`0000_silly_red_wolf` … `0002_funny_wolverine`), reset that branch or recreate the database before applying the current single `0000_crazy_johnny_storm` migration. Greenfield local Docker is unaffected.

### 6. Start dev servers

```bash
bun run dev
```

| App | URL | Role |
| --- | --- | --- |
| Web | [http://localhost:3001](http://localhost:3001) | Marketing, public pages |
| Console | [http://localhost:3002](http://localhost:3002) | OAuth issuer, login, consent, device |

`functhis deploy` stores a **content hash** of the source tree in Postgres and puts the runnable bundle in KV.

Run a single app:

```bash
bun run dev:web       # port 3001
bun run dev:console   # port 3002
```

Optional: both Workers in one Wrangler dev session (exercises Hyperdrive bindings when configured):

```bash
bun run --filter @functhis/infra dev:workers
```

### 7. Verify

- Open [http://localhost:3002/login](http://localhost:3002/login) and sign in with GitHub
- Run `bun run check-types` and `bun run check` before pushing

## Production database (Neon + Hyperdrive)

Local Docker is enough for day-to-day dev. Deployed Workers use Neon through Hyperdrive (auth: cache disabled on console; catalog: cache enabled on web).

1. Set `DATABASE_URL` in `packages/db/.env` to your Neon **direct** (unpooled) URL when running migrations against remote.
2. Provision Cloudflare resources with Terraform in `packages/infra` (see **Deployment** below). Paste `hyperdrive_auth_id`, `hyperdrive_catalog_id`, and `secrets_store_id` from `terraform output` into `apps/console/wrangler.jsonc` and `apps/web/wrangler.jsonc` before deploy.
3. Set the same `RUNTIME_EXECUTE_SECRET` on **web** and **runtime** Workers (`wrangler secret put RUNTIME_EXECUTE_SECRET` for preview/production). Local dev uses the placeholder in root `apps/web/wrangler.jsonc` and `apps/runtime/wrangler.jsonc`. The runtime worker has `workers_dev: false` and only accepts `/execute` when the secret header is present.

Auth queries must not use a cached Hyperdrive config on the console Worker.

## Database (reference)

Postgres + Drizzle. Local: Docker + `packages/db/.env` `DATABASE_URL`. Production runtime: `env.HYPERDRIVE.connectionString`. Migrations always use `DATABASE_URL` from `packages/db/.env`, never through Hyperdrive.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from '@functhis/ui/components/button';
```

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` on `bun install` and via `bun run env:generate`. Commit schemas; keep secrets in ignored `.env` files.

| Package | `.env` path | Purpose |
| --- | --- | --- |
| `packages/db` | `packages/db/.env` | `DATABASE_URL` — migrations + local dev DB |
| `apps/console` | `apps/console/.env` | Better Auth + GitHub OAuth |
| `apps/web` | `apps/web/.env` | `CONSOLE_URL` (optional locally) |

Worker bindings (`HYPERDRIVE`, etc.) come from Wrangler, not Varlock. Local dev reads `packages/db/.env` automatically via `scripts/run-with-local-database-url.ts` — no manual `CLOUDFLARE_HYPERDRIVE_*` export.

CIMD metadata fetch runs only on the **console** Worker. `apps/console/wrangler.jsonc` sets `global_fetch_strictly_public` so `fetch()` blocks private targets after DNS; `packages/auth` also validates HTTPS URLs before fetch. Regenerate Worker types after Wrangler changes: `bun run cf-typegen` (also runs on `bun install`).

See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

## Deployment

Terraform in [`packages/infra`](packages/infra) owns account-level Cloudflare resources. Wrangler deploys first-party Worker code. See [architecture.md](architecture.md).

**Prerequisites:** [Terraform](https://www.terraform.io/) CLI, `CLOUDFLARE_API_TOKEN`, R2 API keys for remote state, Neon **direct** URL, GitHub OAuth app (production callback `https://console.functhis.now/api/auth/callback/github`).

**One-time:** create the state bucket (not managed by Terraform):

```bash
wrangler r2 bucket create functhis-tf-state
```

**Per environment** (preview or production):

```bash
cd packages/infra
cp preview.tfvars.example preview.tfvars   # or production.tfvars.example

terraform init -reconfigure \
  -backend-config="key=preview/terraform.tfstate" \
  -backend-config="access_key=$R2_ACCESS_KEY_ID" \
  -backend-config="secret_key=$R2_SECRET_ACCESS_KEY" \
  -backend-config="endpoints={s3=\"https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com\"}"

bun run --filter @functhis/infra tf:preview
```

After apply: update Hyperdrive and Secrets Store IDs in Wrangler `preview` / `production` env blocks, deploy Workers (`deploy:preview`), then set `enable_domains = true` in tfvars and apply again for custom domains.

- Workers: `functhis-web` + `functhis-console` + `functhis-runtime` (Dynamic Workers LOADER)
- Auth issuer: `https://console.functhis.now` (preview: `https://console.preview.functhis.now`)
- Dev: `bun run dev` (web 3001 + console 3002)
- Migrations: `bun run db:migrate:local` (Neon direct URL; never through Hyperdrive)

Do not create customer packages or dispatch namespaces in Terraform. Package deploys go through the deploy API: source hash, KV bundle, Postgres version row.

### Alpha smoke (CLI deploy + execute)

Use the repo example package [`examples/hello-world`](examples/hello-world) (see [examples/README.md](examples/README.md)).

1. Start stack: `bun run dev` (web + console). For execute via service binding, also run `bun run --filter @functhis/runtime-worker dev:bare` in another terminal.
2. Log in: `bun run --filter @functhis/cli dev -- login` (device flow against console; tokens in `~/.config/functhis/config.json`).
3. `bun run example:hello:dev` then `bun run example:hello:deploy` (see [`examples/hello-world`](examples/hello-world)).
4. Execute: `POST /api/deploy/execute` with Bearer token and `{ "versionId", "functionSlug": "hello", "input" }` (curl in the example README).
5. Deploy again for v2; rollback by updating `package.currentVersionId` in Postgres to the prior version id (no rebuild if that version’s KV key still exists).

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`
- Run checks: `bun run check`

## Project Structure

```
functhis/
├── examples/
│   └── hello-world/ # Sample package for CLI smoke tests
├── apps/
│   ├── web/         # Marketing + deploy API (functhis.now)
│   ├── console/     # OAuth issuer + dashboard (console.functhis.now)
│   └── runtime/     # Dynamic Workers execute (LOADER + KV bundles)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # Shared oRPC / business logic (multi-app only)
│   ├── auth/        # createAuth, CIMD fetch, CLI client seed, deploy bearer
│   ├── cli/         # functhis login, deploy, local dev stub
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start web (3001) and console (3002) in parallel
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:console`: Start only the console application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:types`: Watch API declarations when running an app individually
- `bun run db:generate`: Generate Drizzle migrations from schema
- `bun run db:migrate:local`: Apply Drizzle migrations to Neon
- `bun run example:hello:dev`: Run [`examples/hello-world`](examples/hello-world) locally (no Cloudflare)
- `bun run example:hello:deploy`: Deploy hello-world via CLI (`functhis login` + `bun run dev`)
- `bun run check`: Run Oxlint and Oxfmt
