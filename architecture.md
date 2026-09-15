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

Alpha ships two first-party Workers on web + console hostnames (see [Fleet](#fleet)). Do not add a package-app zone.

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

Thin owner app at `apps/console`. Not the shareable object.

Alpha: GitHub login, MCP consent, device approval, signed-in home. No package list yet.

Try-it lives on the public function page. No billing, org admin, or catalog in alpha.

## MCP

`https://mcp.functhis.now/mcp`. Two tools.

**`search`** — `query`, optional `domain`: `mine` | `org` | `library`. Lexical over contracts the caller may see. Alpha: `mine` only.

**`execute`** — id + JSON arguments. ACL, quota, Dynamic Worker, execution row. Not one MCP tool per function.

## Fleet

Two product scripts today (web + console). Runtime worker arrives later. Untrusted package code must not share a failure domain with login or MCP HTTP.

| Script | Public surface | Owns | Binds |
| --- | --- | --- | --- |
| `functhis-web` | `functhis.now` | TanStack Start, public GET pages, deploy API (later) | Neon via Hyperdrive |
| `functhis-console` | `console.functhis.now` | TanStack Start, OAuth issuer, login/consent/device | Neon via Hyperdrive, `global_fetch_strictly_public` |
| `functhis-runtime` | none (later) | Worker Loader execution, execution rows | Neon via Hyperdrive, bundle KV, `LOADER` |

Local `bun run dev` runs web (3001) and console (3002) with the same Hyperdrive binding config. `bun run db:migrate:local` applies Drizzle migrations to Neon. Production deploys Workers independently.

Cross-worker calls use service bindings. Do not proxy Postgres through RPC; scripts that need the database bind the same Hyperdrive config.

Do not put Durable Object classes on `functhis-web` or `functhis-console`. If a DO is needed later, add a third script rather than attaching it to origin.

## Infra

Terraform owns account-level resources. Wrangler owns first-party Worker **code** and Hyperdrive binding ids. Never manage the same resource in both. **No Alchemy.**

```text
packages/infra/terraform     Cloudflare provider v5, R2 remote state (later)
apps/web/wrangler.jsonc      functhis-web
apps/console/wrangler.jsonc  functhis-console
apps/runtime/wrangler.jsonc  functhis-runtime (later)
```

**Terraform** (per env `preview` / `production`):

- Zone `functhis.now`, DNS, Worker routes for the three hostnames
- Neon Postgres project (connection string in Secrets Store; Hyperdrive configs point at Neon **direct** / unpooled host)
- Hyperdrive `functhis-auth` (caching disabled — auth, sessions, OAuth). Add a second cache-enabled Hyperdrive when catalog tables land.
- KV `functhis-bundles`
- R2 `functhis-tf-state` (state backend) and later execution-output buckets
- Secrets Store (platform secrets: `BETTER_AUTH_SECRET`, GitHub OAuth)
- Analytics Engine datasets for executions / quota hits
- Observability destinations

**Wrangler** (CI after `terraform apply`):

- `wrangler deploy` per Worker
- `drizzle-kit migrate` against Neon (direct URL; not through Hyperdrive)
- `wrangler types`
- Optional: `wrangler dev -c apps/web/wrangler.jsonc -c apps/console/wrangler.jsonc`

Pin `cloudflare/cloudflare` to `~> 5`. Auth via `CLOUDFLARE_API_TOKEN`. State backend is R2 (S3-compatible). Environments are directories, not Terraform modules — v5 resources do not compose cleanly.

**Not Terraform:** customer packages, Artifacts repos, bundle KV keys, Postgres catalog rows. Those are the deploy API.

## Runtime

Not Workers for Platforms. Customer packages are not persisted as account scripts and are not uploaded into a dispatch namespace.

Package code runs as a **Dynamic Worker** on `functhis-runtime` via a Worker Loader binding (`env.LOADER`).

- Authors write ordinary TypeScript; no Functhis SDK. No author `wrangler.toml`.
- One isolate per **package version**. `LOADER.get(versionId, () => bundle)` reuses a warm isolate; `load()` is only for one-off try-it of unpublished code.
- Isolation: no parent `env`. Bindings the Dynamic Worker receives are explicit and empty in alpha.
- Limits on `getEntrypoint()`: `cpuMs` and `subRequests` from the caller’s plan. Fail closed.
- Network: `globalOutbound` allowed in alpha (tools wrap APIs). Later: host allowlist / intercept. Never inherit origin secrets.
- Observability: Tail Worker / traces on `functhis-runtime` capture isolate logs.

Do not add a Workers for Platforms dispatch namespace unless custom-domain hostname routing later needs it. Dynamic Workers already cover isolation, per-invoke limits, warm reuse, and egress control.

## Source and bundles

Three layers. Do not collapse them.

```text
Artifacts repo     versioned source tree (git-compatible). One repo per package.
KV bundle          compiled Worker Loader modules, keyed by content hash.
Postgres catalog   ACL, slugs, currentVersionId, execution rows.
```

Deploy:

```text
CLI → deploy API
  → write files to the package’s Artifacts repo (commit)
  → bundle for Workers (esbuild / worker-bundler; no Node builtins)
  → PUT modules to KV under the bundle hash
  → insert immutable package_version, point package.currentVersionId
```

Execute (public POST and MCP `execute`):

```text
ACL + quota on functhis-web
  → RUNTIME service binding
  → LOADER.get(versionId, () => KV bundle)
  → getEntrypoint(null, { limits })
  → fetch()
  → execution row
```

Rollback is `currentVersionId = previous`. The loader id is the version id, so the isolate changes immediately. Slug rename does not recreate the repo.

R2 is not the source of truth for package trees. Use it later for large execution outputs (PDFs, archives), not for source or the hot-path bundle.

## Data

Postgres metadata. Better Auth tables stay in `packages/db/src/schema/auth.ts`. After plugins: `oauthClient`, tokens, consent, JWT keys, `organization` / `member` / `invitation`.

| Table | Notes |
| --- | --- |
| `package` | `slug`, `ownerUserId`, optional `organizationId`, `visibility` (`private` \| `organization` \| `library`), `artifactsRepoName`, `currentVersionId` |
| `function` | `packageId`, `exportName`, `path`, `slug`, contract JSON. Unique `(packageId, slug)` |
| `package_version` | Immutable: Artifacts commit, bundle hash, contracts, createdBy |
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
apps/web          hosted origin: public pages + POST (later)
apps/console      OAuth issuer + thin dashboard
apps/runtime      hosted: Worker Loader, execute path (later)
apps/cli          OSS: login, deploy, local run (later)
apps/fumadocs     existing
packages/auth     createAuth, CIMD fetch, CLI client seed
packages/db       schema
packages/api      shared oRPC / business logic (see below)
packages/runtime  OSS: discover, contracts, bundle, worker template (later)
packages/protocol OSS: contract + search/execute types (later)
packages/mcp      search/execute handlers (later)
packages/infra    Wrangler dev/migrate wiring; Terraform later
packages/ui       existing
```

**`packages/api` sharing rule:** shared oRPC and business logic for code that **more than one app** will call (web, console, MCP HTTP later). Do **not** put procedures or types that only one app uses there. App-only API stays in that app until a second consumer appears; then extract. Console does not depend on `@functhis/api` in the auth phase.

OSS: CLI, `runtime`, `protocol`. Hosted: auth, ACL, Artifacts, Dynamic Workers, URLs, quotas, history.

CLI: `functhis login` (device), `functhis deploy`, `functhis run` / `dev`. No Docker. No author wrangler.toml.

## Flows

```text
Agent:  OAuth at console.functhis.now → consent on console
        POST mcp.functhis.now/mcp execute { id: "@xmazu/pkg/fn", arguments }
        → ACL → functhis-runtime → Dynamic Worker

Human:  GET  functhis.now/@xmazu/pkg/fn  page
        POST functhis.now/@xmazu/pkg/fn  run

CLI:    login → console.functhis.now/device
        deploy → Artifacts commit + KV bundle + package_version
        → https://functhis.now/@xmazu/package/function
```

## Defer

Billing, marketplace, library UX, org admin, Infisical, credential broker, custom domains, OpenAPI, workflows, Python, embeddings, one MCP tool per function, `run.` hostname, Workers for Platforms, per-package Durable Objects, managed execution-output storage.
