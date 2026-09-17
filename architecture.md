# Architecture

Decisions for the hosted product and CLI. Product intent lives in [vision.md](vision.md). Build order lives in [roadmap.md](roadmap.md).

Public language is **package**. Vision still says “project”; same boundary.

## Hosts

One Cloudflare account.

| Host | Role |
| --- | --- |
| `https://functhis.now` | Marketing, public registry, deploy API audience |
| `https://console.functhis.now` | OAuth issuer, owner dashboard; login, consent, device approval |
| `https://mcp.functhis.now` | MCP resource. Tools: `search`, `execute`. Token `aud`. |

No `run.` host. Cookies: `.functhis.now`. `trustedOrigins`: apex + console.

Alpha ships three first-party Workers: web, console, mcp (see [Fleet](#fleet)). Do not add a package-app zone.

## Public URLs

Identity is the URL. GET is the page. POST runs.

```text
https://functhis.now/@xmazu/presentation-tools
https://functhis.now/@xmazu/presentation-tools/generate-presentation
```

- GET HTML: package or function page (contract, examples, try-it). Try-it POSTs.
- GET `Accept: application/json`: contract only. Never execute.
- POST JSON: execute. Same ACL and quotas as MCP `execute`.
- `@` is reserved. Marketing routes do not start with `@`.
- Private: locked GET (or 404). POST needs a Functhis bearer token.
- MCP ids are the path: `@xmazu/presentation-tools/generate-presentation`.

Compute identity is the package version id (`ver_{versionId}`). Slugs can change without moving the isolate.

## Auth

GitHub is the IdP (`socialProviders.github`). Functhis is the OAuth 2.1 authorization server at **`https://console.functhis.now`**.

Mount **`mcp()`**, not `oauthProvider()`. `mcp()` is that provider with MCP defaults. Do not register both.

```text
GitHub           → session into Functhis
Functhis (mcp()) → AS on console.functhis.now
mcp.functhis.now → MCP resource
deploy API       → CLI resource (same AS, different audience)
console          → session cookies + issuer pages
```

`createAuth` plugins:

- `jwt()`
- `mcp({ loginPage, consentPage, resource: "https://mcp.functhis.now" })`
- `cimd({ metadataProfile: "mcp-2026-07-28", fetchClientMetadataResource })` — no DCR unless an old client requires it
- `oauthDeviceAuthorization({ verificationUri: "/device" })`
- `organization()` — schema only in alpha
- `crossSubDomainCookies` on `.functhis.now`

Login / consent / device pages: `https://console.functhis.now/...`. Issuer: `https://console.functhis.now`.

Workers: do not use the Node CIMD transport. Use `global_fetch_strictly_public` on `functhis-console` so `fetch()` refuses private/special-use IPs after DNS. `fetchClientMetadataResource` enforces HTTPS, no credentials/fragments, GET/HEAD only, `redirect: "error"`, timeout + size cap. No userland IP pinning.

Forward issuer well-known URLs to `auth.handler`, not only `/api/auth/*`:

- `{issuer}/.well-known/oauth-authorization-server`
- `{issuer}/.well-known/openid-configuration` if `openid` is issued
- `mcp.functhis.now/.well-known/oauth-protected-resource`
- `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userinfo`, JWKS

MCP POST `/mcp`: `requireMcpAuth` / `createMcpProtectedRequestHandler`. CLI device token is bound to the deploy API resource (`https://functhis.now`), not MCP.

## Console

Thin owner app at `apps/console`. Not the shareable object. Visual system: [apps/console/DESIGN.md](apps/console/DESIGN.md).

Alpha: GitHub login, MCP consent, device approval, signed-in home. No package list yet.

Try-it lives on the public function page. No billing, org admin, or catalog in alpha.

## MCP

`https://mcp.functhis.now/mcp`. Two tools.

**`search`** — `query`, optional `domain`: `mine` | `org` | `library`. Lexical over contracts the caller may see. Alpha: `mine` only.

**`execute`** — id + JSON arguments. ACL, quota, Dynamic Worker, execution row. Not one MCP tool per function.

## Fleet

Three product Workers (web, console, mcp). Untrusted package code must not share a failure domain with login or OAuth issuer HTTP.

| Script | Public surface | Owns | Binds |
| --- | --- | --- | --- |
| `functhis-web` | `functhis.now` | TanStack Start, public GET pages, deploy API, `@` POST (phase 5) | Neon via Hyperdrive, bundle KV (deploy) |
| `functhis-console` | `console.functhis.now` | TanStack Start, OAuth issuer, login/consent/device | Neon via Hyperdrive, `global_fetch_strictly_public` |
| `functhis-mcp` | `mcp.functhis.now` | MCP `search` / `execute`, Dynamic Worker execution (phase 6) | Neon via Hyperdrive, bundle KV, `LOADER`, Analytics Engine |

Local `bun run dev` runs web (3001), console (3002), and MCP (3003). `bun run db:migrate:local` applies Drizzle migrations to Neon. Production deploys Workers independently (**mcp first**, then web, then console) before Terraform custom domains point `mcp.*` at `functhis-mcp`.

Cross-worker calls use service bindings. Do not proxy Postgres through RPC; scripts that need the database bind the same Hyperdrive config.

Do not put Durable Object classes on `functhis-web` or `functhis-console`. If a DO is needed later, add a third script rather than attaching it to origin.

## Infra

Terraform owns account-level resources. Wrangler owns first-party Worker **code** and Hyperdrive binding ids. Never manage the same resource in both. **No Alchemy.**

```text
packages/infra/*.tf          Cloudflare provider v5, R2 remote state (preview/production tfvars)
apps/web/wrangler.jsonc      functhis-web (+ preview/production env blocks)
apps/console/wrangler.jsonc  functhis-console (+ preview/production env blocks)
apps/mcp/wrangler.jsonc      functhis-mcp (+ preview/production env blocks)
```

**Terraform** (`packages/infra`, apply with `preview.tfvars` or `production.tfvars`):

- Zone `functhis.now` (data source), Workers custom domains for the three hostnames (`enable_domains` after first deploy)
- Neon Postgres project stays in the dashboard; connection string in Secrets Store and Hyperdrive origin (Neon **direct** / unpooled host)
- Hyperdrive `functhis-auth-{env}` (caching disabled — console) and `functhis-catalog-{env}` (cache enabled — web)
- KV `functhis-bundles-{env}`
- R2 `functhis-tf-state` (state backend only — create once with `wrangler r2 bucket create`; not a Terraform resource)
- Secrets Store `functhis-{env}` (`BETTER_AUTH_SECRET`, GitHub OAuth). Migrations use Neon direct URL from `packages/db/.env` / CI, not Workers.
- Analytics Engine execution metrics: Wrangler-bound on `functhis-mcp` (`functhis_executions` / `functhis_executions_preview`; dataset names in Terraform output `analytics_execution_dataset`)

**Wrangler** (after `terraform apply`, paste output IDs into env blocks in `apps/*/wrangler.jsonc`):

- `bun run --filter @functhis/infra deploy:preview` or `deploy:production`
- `drizzle-kit migrate` against Neon (direct URL; not through Hyperdrive)
- `wrangler types` / `bun run cf-typegen`
- Optional: `bun run --filter @functhis/infra dev:workers`

Pin `cloudflare/cloudflare` to `~> 5`. Auth via `CLOUDFLARE_API_TOKEN`. State backend is R2 (S3-compatible); treat state as confidential (origin passwords and secret values). One Terraform root; preview and production differ by var-file and backend state key, not separate module trees. Commit `.terraform.lock.hcl` after `terraform init`.

**Not Terraform:** customer packages, bundle KV keys, Postgres catalog rows. Those are the deploy API.

## Runtime

Not Workers for Platforms. Customer packages are not persisted as account scripts and are not uploaded into a dispatch namespace.

Package code runs as a **Dynamic Worker** on `functhis-mcp` via a Worker Loader binding (`env.LOADER`). Implementation lives in `apps/mcp` (`src/execute.ts`); HTTP `search` / `execute` tools ship in phase 6.

- Authors write ordinary TypeScript; no Functhis SDK. No author `wrangler.toml`.
- One isolate per **package version**. `LOADER.get(versionId, () => bundle)` reuses a warm isolate; `load()` is only for one-off try-it of unpublished code.
- Isolation: no parent `env`. Bindings the Dynamic Worker receives are explicit and empty in alpha.
- Limits on `getEntrypoint()`: `cpuMs` and `subRequests` from the caller’s plan. Fail closed.
- Network: omit `globalOutbound` in the loader config so Dynamic Workers use default outbound (tools wrap APIs in alpha). Later: host allowlist / intercept. Never inherit origin secrets (`env: {}`).
- Observability: Workers Analytics Engine data points per execute; Tail Worker / traces on `functhis-mcp` capture isolate logs.

Do not add a Workers for Platforms dispatch namespace unless custom-domain hostname routing later needs it. Dynamic Workers already cover isolation, per-invoke limits, warm reuse, and egress control.

## Source and bundles

Three layers. Do not collapse them.

```text
Source hash        deterministic hash of the deployed source tree (metadata only in alpha).
KV bundle          compiled Worker Loader modules, keyed by content hash.
Postgres catalog   ACL, slugs, currentVersionId, execution rows.
```

Deploy:

```text
CLI → deploy API
  → record source hash from the CLI
  → bundle for Workers (esbuild / worker-bundler; no Node builtins)
  → PUT modules to KV under the bundle hash
  → insert immutable package_version, point package.currentVersionId
```

Execute (public POST and MCP `execute`):

```text
ACL + quota on functhis-web (POST @…) or functhis-mcp (MCP execute tool)
  → functhis-mcp: LOADER.get(versionId, () => KV bundle)
  → getEntrypoint(null, { limits })
  → fetch()
  → execution row (+ Analytics Engine on mcp)
```

Phase 5 may call the same execute path on `functhis-mcp` via a service binding from web; phase 6 exposes it to agents at `mcp.functhis.now`.

Rollback is `currentVersionId = previous`. The loader id is the version id, so the isolate changes immediately.

Canonical source stays with the author (local tree / their Git). Functhis stores a deployed snapshot hash and the KV bundle. Reuse is `execute` (or HTTP POST) of a published function, not importing or forking source. Do not use Cloudflare Artifacts. Do not stand up a Git host for package trees.

R2 is not the source of truth. Use it later for optional read-only source snapshots on the function page and for large execution outputs (PDFs, archives), not for the hot-path bundle.

Do not copy Kody’s in-platform Git workspace or Gram’s third-party MCP Registry catalog. Functhis `search` domain `library` is later discovery of **our** published functions, not proxying other MCP servers.

## Data

Postgres metadata. Better Auth tables stay in `packages/db/src/schema/auth.ts`. After plugins: `oauthClient`, tokens, consent, JWT keys, `organization` / `member` / `invitation`.

| Table | Notes |
| --- | --- |
| `package` | `slug`, `ownerUserId`, optional `organizationId`, `visibility` (`private` \| `organization` \| `library`), `currentVersionId` |
| `function` | `packageId`, `exportName`, `path`, `slug`, contract JSON. Unique `(packageId, slug)` |
| `package_version` | Immutable: source hash, bundle hash, contracts, createdBy |
| `execution` | Thin: caller, status, cpu/ms, size. Retention-capped |

Owner handle (`@xmazu`) is unique. Default from GitHub username.

Alpha ACL: `ownerUserId = me`. Org columns exist; filters unused until sharing.

Later ACL:

```text
ownerUserId = me
or (organizationId in memberships and visibility in organization|library)
or visibility = library
```

Quotas fail closed from day one: CPU, concurrency, request/response size.

## Repo

```text
apps/web          hosted origin: public pages + deploy API + POST (public URLs later)
apps/console      OAuth issuer + thin dashboard
apps/mcp          hosted: mcp.functhis.now, MCP tools + Worker Loader execute
apps/cli          OSS: login, deploy, local run (later)
apps/fumadocs     existing
packages/auth     createAuth, CIMD fetch, CLI client seed
packages/db       schema
packages/api      shared oRPC / business logic (see below)
packages/runtime  OSS: discover, contracts, bundle, worker template (later)
packages/protocol OSS: contract + search/execute types (later)
packages/infra    Terraform (flat .tf root) + Wrangler deploy/migrate scripts
packages/ui       existing
```

**`packages/api` sharing rule:** shared oRPC and business logic for code that **more than one app** will call (web, console, MCP HTTP later). Do **not** put procedures or types that only one app uses there. App-only API stays in that app until a second consumer appears; then extract. Console does not depend on `@functhis/api` in the auth phase.

OSS: CLI, `runtime`, `protocol`. Hosted: auth, ACL, Dynamic Workers, URLs, quotas, history.

CLI: `functhis login` (device), `functhis deploy`, `functhis run` / `dev`. No Docker. No author wrangler.toml.

## Flows

```text
Agent:  OAuth at console.functhis.now → consent on console
        POST mcp.functhis.now/mcp execute { id: "@xmazu/pkg/fn", arguments }
        → ACL → functhis-mcp → Dynamic Worker

Human:  GET  functhis.now/@xmazu/pkg/fn  page
        POST functhis.now/@xmazu/pkg/fn  run

CLI:    login → console.functhis.now/device
        deploy → source hash + KV bundle + package_version
        → https://functhis.now/@xmazu/package/function
```

## Defer

Billing, marketplace, library UX, org admin, Infisical, credential broker, custom domains, OpenAPI, workflows, Python, embeddings, one MCP tool per function, `run.` hostname, Workers for Platforms, per-package Durable Objects, managed execution-output storage, Cloudflare Artifacts, source remix / import, proxying the MCP Registry.
