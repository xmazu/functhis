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
cp apps/web/.env.example apps/web/.env   # if missing
cp apps/mcp/.env.example apps/mcp/.env   # if missing
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

Publish writes function bundles to the web worker’s local KV. The MCP worker reads the same **BUNDLES** namespace, so `apps/mcp` dev uses `--persist-to ../web/.wrangler/state`. If `search` finds a function but `execute` returns “Function not found”, restart dev (or republish after clearing KV).

**Cursor:** [`.cursor/mcp.json`](./.cursor/mcp.json) points at `http://localhost:3003/mcp` with static OAuth client `functhis-cursor-mcp` (Cursor does not support our CIMD-only registration). Restart **`bun run dev`** so the web worker seeds that client, then enable **`functhis-local`** in **Settings → Tools & MCP** and sign in on http://localhost:3001. If logs say `does not support dynamic client registration`, pull latest and confirm `auth.CLIENT_ID` is present in `mcp.json`.

Web only:

```bash
bun run dev:web
```

Sign in at http://localhost:3001/login to exercise OAuth flows.

## Stripe billing (optional)

Org billing in `/d` uses the Better Auth Stripe plugin (`packages/auth/src/stripe-plugin.ts`). **You do not need Stripe to develop** publish, MCP, or most of the owner UI—login, packages, secrets, and execute work without it. When Stripe env vars are unset, `billingEnabled` stays false and entitlements still come from Postgres (trial limits, etc.).

### Plans and env vars

Paid plan amounts and limits live in `packages/publish/src/org/plan-catalog.ts` (`FUNCTHIS_PLANS`: Developer **$19/mo**, Team **$79/mo**). Trial and Enterprise have no Stripe price.

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API key (`sk_test_…` locally) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/auth/stripe/webhook` |
| `STRIPE_PRICE_DEVELOPER_MONTHLY` | Price id (`price_…`) for the `developer` plan |
| `STRIPE_PRICE_TEAM_MONTHLY` | Price id for the `team` plan |
| `STRIPE_PRO_PRICE_ID` | Legacy alias for the developer price (optional if `STRIPE_PRICE_DEVELOPER_MONTHLY` is set) |

All of the above belong in **`apps/web/.env`** only (see `apps/web/.env.example` and `.env.schema`). MCP does not need Stripe keys.

### Sync products and prices (local test mode)

Scripts under `packages/auth/scripts/` mirror the idempotent catalog sync from `@xmazu/platforms-billing` (`metadata.plan` = `developer` | `team`):

```bash
# Creates or reuses Stripe products/prices from FUNCTHIS_PLANS; merges price ids into apps/web/.env
STRIPE_SECRET_KEY=sk_test_... bun run stripe:setup --write-env
```

Add `STRIPE_SECRET_KEY=sk_test_...` to `apps/web/.env` if it is not there yet, then re-run if you only synced prices.

### Webhooks locally

Better Auth expects events at **`http://localhost:3001/api/auth/stripe/webhook`** in dev.

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Use the **same** Stripe account as `STRIPE_SECRET_KEY` (`stripe login` if needed).
3. Forward webhooks and copy the signing secret into `apps/web/.env`:

```bash
stripe listen --forward-to http://localhost:3001/api/auth/stripe/webhook
# Paste whsec_... as STRIPE_WEBHOOK_SECRET, restart bun run dev
```

After `bun run dev` is up, exercise checkout from `/d` billing UI (org owner/admin). Subscription rows land in Postgres via the plugin; MCP execution quotas still read Postgres, not Stripe on the hot path.

### Production

Production binds the same names from **Cloudflare Secrets Store** (`apps/web/wrangler.jsonc` `env.production`). Terraform does not create Stripe secrets.

```bash
STRIPE_SECRET_KEY=sk_live_... bun run stripe:setup --write-env
# After functhis-web is live:
STRIPE_SECRET_KEY=sk_live_... bun run stripe:setup --url https://functhis.now --rotate-webhook
set -a && source apps/web/.env && set +a
bun run stripe:setup --push-secrets-store
```

See [README.md — Deployment](./README.md#deployment) for the full deploy checklist.

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
