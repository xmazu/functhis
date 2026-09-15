# Architecture

Decisions for the hosted product and CLI. Product intent lives in [vision.md](vision.md). Build order lives in [roadmap.md](roadmap.md).

Public language is **package**. Vision still says “project”; same boundary.

## Hosts

One Cloudflare account.

| Host | Role |
| --- | --- |
| `https://functhis.now` | Marketing, OAuth issuer (`baseURL`), public registry |
| `https://console.functhis.now` | Owner dashboard; login, consent, device approval |
| `https://mcp.functhis.now` | MCP resource. Tools: `search`, `execute`. Token `aud`. |

No `run.` host. Cookies: `.functhis.now`. `trustedOrigins`: both `functhis.now` and `console.functhis.now`.

Alpha ships two first-party Workers on those hostnames (see [Fleet](#fleet)). Do not add a package-app zone.

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

GitHub is the IdP (`socialProviders.github`). Functhis is the OAuth 2.1 authorization server.

Mount **`mcp()`**, not `oauthProvider()`. `mcp()` is that provider with MCP defaults. Do not register both.

```text
GitHub           → session into Functhis
Functhis (mcp()) → AS
mcp.functhis.now → MCP resource
deploy API       → CLI resource (same AS, different audience)
console          → session cookies
```

`createAuth` plugins:

- `jwt()`
- `mcp({ loginPage, consentPage, resource: "https://mcp.functhis.now" })`
- `cimd({ metadataProfile: "mcp-2026-07-28", fetchClientMetadataResource })` — no DCR unless an old client requires it
- `oauthDeviceAuthorization({ verificationUri: "https://console.functhis.now/device" })`
- `organization()` — schema only in alpha
- `crossSubDomainCookies` on `.functhis.now`

Login / consent / device pages: `https://console.functhis.now/...`. Issuer stays `https://functhis.now`.

Workers: do not use the Node CIMD transport. Fetch must resolve DNS once, reject RFC 6890 special-use addresses, pin the IP, refuse redirects.

Forward issuer well-known URLs to `auth.handler`, not only `/api/auth/*`:

- `{issuer}/.well-known/oauth-authorization-server`
- `{issuer}/.well-known/openid-configuration` if `openid` is issued
- `mcp.functhis.now/.well-known/oauth-protected-resource`
- `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userinfo`, JWKS

MCP POST `/mcp`: `requireMcpAuth` / `createMcpProtectedRequestHandler`. CLI device token is bound to the deploy API resource, not MCP.

## Console

Thin owner app. Not the shareable object.

Alpha: GitHub login, MCP consent, device approval, package list, live URL, copy MCP URL + function id, recent executions.

Try-it lives on the public function page. No billing, org admin, or catalog in alpha.

## MCP

`https://mcp.functhis.now/mcp`. Two tools.

**`search`** — `query`, optional `domain`: `mine` | `org` | `library`. Lexical over contracts the caller may see. Alpha: `mine` only.

**`execute`** — id + JSON arguments. ACL, quota, Dynamic Worker, execution row. Not one MCP tool per function.

## Fleet

Two product scripts. Untrusted package code must not share a failure domain with login or MCP HTTP.

| Script | Public surface | Owns | Binds |
| --- | --- | --- | --- |
| `functhis-web` | `functhis.now`, `console.functhis.now`, `mcp.functhis.now` | TanStack Start, OAuth, MCP HTTP, deploy API, public GET pages | D1, Artifacts, bundle KV, Secrets Store, `RUNTIME` |
| `functhis-runtime` | none | Worker Loader execution, execution rows | D1, bundle KV, `LOADER` |

Local `bun run dev` attaches both in one Miniflare. Production deploys them independently. UI-only changes upload web and skip runtime.

Cross-worker calls use service bindings. Do not proxy D1 through RPC; both scripts bind the same database.

Do not put Durable Object classes on `functhis-web`. If a DO is needed later, add a third script rather than attaching it to origin.

## Infra

Terraform owns account-level resources. Wrangler owns first-party Worker **code** and D1 migrations. Never manage the same resource in both.

```text
packages/infra/terraform     Cloudflare provider v5, R2 remote state
apps/web/wrangler.jsonc      functhis-web
apps/runtime/wrangler.jsonc  functhis-runtime
```

**Terraform** (per env `preview` / `production`):

- Zone `functhis.now`, DNS, Worker routes for the three hostnames
- D1 `functhis` (id only; schema via Wrangler migrations)
- KV `functhis-bundles`
- R2 `functhis-tf-state` (state backend) and later execution-output buckets
- Secrets Store (platform secrets: `BETTER_AUTH_SECRET`, GitHub OAuth)
- Analytics Engine datasets for executions / quota hits
- Observability destinations

**Wrangler** (CI after `terraform apply`):

- `wrangler deploy` for `functhis-web` and `functhis-runtime`
- `wrangler d1 migrations apply`
- `wrangler types`
- Local `wrangler dev`

Pin `cloudflare/cloudflare` to `~> 5`. Auth via `CLOUDFLARE_API_TOKEN`. State backend is R2 (S3-compatible). Environments are directories, not Terraform modules — v5 resources do not compose cleanly.

**Not Terraform:** customer packages, Artifacts repos, bundle KV keys, D1 rows. Those are the deploy API.

Artifacts namespaces (`functhis-preview`, `functhis-production`) are bound by name in Wrangler. Create them with Wrangler or the Artifacts API if the Terraform provider has no namespace resource. Namespaces auto-create on first repo; still pin the name in config.

Cloudflare Artifacts is closed beta. Production requires account access.

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
D1 catalog         ACL, slugs, currentVersionId, execution rows.
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

D1 metadata. Better Auth tables stay in `packages/db/src/schema/auth.ts`. After plugins: `oauthClient`, tokens, consent, JWT keys, `organization` / `member` / `invitation`.

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
apps/web          hosted origin: public pages + POST, console, /mcp, deploy API
apps/runtime      hosted: Worker Loader, execute path
apps/cli          OSS: login, deploy, local run
apps/fumadocs     existing
packages/auth     createAuth
packages/db       schema
packages/api      oRPC
packages/runtime  OSS: discover, contracts, bundle, worker template
packages/protocol OSS: contract + search/execute types
packages/mcp      search/execute handlers
packages/infra    Terraform + Wrangler wiring
packages/ui       existing
```

OSS: CLI, `runtime`, `protocol`. Hosted: auth, ACL, Artifacts, Dynamic Workers, URLs, quotas, history.

CLI: `functhis login` (device), `functhis deploy`, `functhis run` / `dev`. No Docker. No author wrangler.toml.

## Flows

```text
Agent:  OAuth at functhis.now → consent on console
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
