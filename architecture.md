# Architecture

Decisions for the hosted product and CLI. Product intent lives in [vision.md](vision.md). Build order lives in [roadmap.md](roadmap.md).

Public language is **package**. Vision still says “project”; same boundary.

## Hosts

One Cloudflare account.

| Host | Role |
| --- | --- |
| `https://functhis.now` | Marketing, OAuth issuer, owner UI (`/d`), deploy API |
| `https://mcp.functhis.now` | MCP resource. Tools: `search`, `execute`. Token `aud`. |

No `run.` host. Cookies: `.functhis.now`. `trustedOrigins`: apex + mcp.

Alpha ships two first-party Workers: web, mcp (see [Fleet](#fleet)). Do not add a package-app zone.

## Function identity

Identity is the MCP id. Execute is MCP `execute`.

```text
@xmazu/presentation-tools/generate-presentation
```

- MCP ids are `@handle/package/function`.
- `@` is reserved. Marketing routes do not start with `@`. Web does not serve `/@…` pages in alpha.
- Compute identity is the package version id (`ver_{versionId}`). Slugs can change without moving the isolate.

## Auth

GitHub is the IdP (`socialProviders.github`). Functhis is the OAuth 2.1 authorization server at **`https://functhis.now`**.

Mount **`mcp()`**, not `oauthProvider()`. `mcp()` is that provider with MCP defaults. Do not register both.

```text
GitHub           → session into Functhis
Functhis (mcp()) → AS on functhis.now
mcp.functhis.now → MCP resource
deploy API       → CLI resource (same AS, different audience)
web              → session cookies + issuer pages (same origin)
```

`createAuth` plugins:

- `jwt()`
- `mcp({ loginPage, consentPage, resource: "https://mcp.functhis.now" })`
- `cimd({ metadataProfile: "mcp-2026-07-28", fetchClientMetadataResource })` - no DCR unless an old client requires it
- `oauthDeviceAuthorization({ verificationUri: "/device" })`
- `organization()` - Better Auth org plugin; owner UI at `/d/orgs` (create, invite via copy link, accept). No outbound invite email in alpha.
- `crossSubDomainCookies` on `.functhis.now`

Login / consent / device pages: `https://functhis.now/...`. Issuer: `https://functhis.now`.

Workers: do not use the Node CIMD transport. Use `global_fetch_strictly_public` on `functhis-web` so `fetch()` refuses private/special-use IPs after DNS. `fetchClientMetadataResource` enforces HTTPS, no credentials/fragments, GET/HEAD only, `redirect: "manual"` (Workers do not support `"error"`), rejects 3xx, timeout + size cap. No userland IP pinning.

Forward issuer well-known URLs to `auth.handler`, not only `/api/auth/*`:

- `{issuer}/.well-known/oauth-authorization-server`
- `{issuer}/.well-known/openid-configuration` if `openid` is issued
- `mcp.functhis.now/.well-known/oauth-protected-resource`
- `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userinfo`, JWKS

MCP POST `/mcp`: `requireMcpAuth` / `createMcpProtectedRequestHandler`. CLI device token is bound to the deploy API resource (`https://functhis.now`), not MCP.

## Owner UI

Signed-in owner app at `apps/web` under `/d` (pkgs, orgs). Visual system: [apps/web/src/routes/d/DESIGN.md](apps/web/src/routes/d/DESIGN.md).

Alpha: GitHub login, workspace onboarding at `/d/onboard`, MCP consent, device approval, signed-in home at `/d`, package list at `/d/pkgs`, package detail at `/d/pkgs/:handle/:slug` (handle is org slug), organizations at `/d/orgs` with Free/Pro billing via Stripe Checkout and Customer Portal, sharing controls on owned packages. Package detail copies MCP ids; there is no try-it playground. Library browse/catalog UI remains later.

## MCP

`https://mcp.functhis.now/mcp`. Two tools. `POST /mcp` serves modern `2026-07-28` and 2025-era Streamable HTTP `initialize` (including `2025-06-18`) via SDK `legacy: 'stateless'`.

**`search`** - `query`, optional `domain`: `mine` | `org` | `library` (default `mine`). Lexical ranking over function ids, slugs, handles, and `search_text` loaded from HOT KV (Kody-style token coverage). Exact `@handle/pkg/fn` matches win first. When the shortlist is ambiguous (more than eight hits and no clear lexical winner), stage 2 reranks the top 20 with OpenRouter **`typesafe/jev-1.13`** via Vercel **AI SDK 7** `experimental_evaluate` and `@openrouter/ai-sdk-provider` (`OPENROUTER_API_KEY`), and falls back to lexical order on missing key, low mean confidence, or Score errors. No pgvector or query embeddings on the hot path.

**`execute`** - id + JSON arguments. ACL, quota, Dynamic Worker, execution row. Not one MCP tool per function.

## Fleet

Two product Workers (web, mcp). Untrusted package code runs on MCP (Dynamic Workers), not on the web Worker.

| Script | Public surface | Owns | Binds |
| --- | --- | --- | --- |
| `functhis-web` | `functhis.now` | TanStack Start, marketing, OAuth issuer, `/d` owner UI, deploy API | Neon via Hyperdrive, bundle KV, HOT KV, artifacts R2 |
| `functhis-mcp` | `mcp.functhis.now` | MCP `search` / `execute`, Dynamic Worker execution | Neon via Hyperdrive (miss-fill + execution rows), bundle KV, HOT KV, `LOADER`, Analytics Engine, Workers AI |

Local `bun run dev` runs web (3001) and MCP (3003). Production deploys **mcp first**, then web.

Web and mcp do not call each other. Do not proxy Postgres through RPC; scripts that need the database bind the same Hyperdrive config.

Do not put Durable Object classes on `functhis-web`. If a DO is needed later, add a dedicated script rather than attaching it to origin.

## Infra

Terraform owns account-level resources. Wrangler owns first-party Worker **code** and Hyperdrive binding ids. Never manage the same resource in both. **No Alchemy.**

```text
packages/infra/*.tf          Cloudflare provider v5, local production state
apps/web/wrangler.jsonc      functhis-web (+ production env block)
apps/mcp/wrangler.jsonc      functhis-mcp (+ production env block)
```

**Terraform** (`packages/infra`, apply with `production.tfvars`):

- Zone `functhis.now` (data source), Workers custom domains for the two hostnames (`enable_domains` after first deploy)
- Neon Postgres project stays in the dashboard; connection string in Secrets Store and Hyperdrive origin (Neon **direct** / unpooled host)
- Hyperdrive `functhis-auth-{env}` (caching disabled - web issuer) and `functhis-catalog-{env}` (cache enabled - mcp)
- KV `functhis-bundles-{env}` (compiled bundles) and `functhis-hot-{env}` (function docs, search indexes, membership, JWKS snapshot)
- R2 `functhis-artifacts-{env}` (published package artifacts; Terraform; not the Terraform state bucket)
- Local Terraform state file (`production.tfstate`, ignored by Git)
- Secrets Store `functhis-{env}` (`BETTER_AUTH_SECRET`, GitHub OAuth, `FUNCTHIS_SECRETS_KEY`). Migrations use Neon direct URL from `packages/db/.env` / CI, not Workers.
- Analytics Engine execution metrics: Wrangler-bound on `functhis-mcp` (`functhis_executions`; dataset name in Terraform output `analytics_execution_dataset`)

**Wrangler** (after `terraform apply`, paste output IDs into env blocks in `apps/*/wrangler.jsonc`):

- `bun run --filter @functhis/infra deploy:production`
- `drizzle-kit migrate` against Neon (direct URL; not through Hyperdrive)
- `wrangler types` / `bun run cf-typegen`
- Optional: `bun run --filter @functhis/infra dev:workers`

Pin `cloudflare/cloudflare` to `~> 5`. Auth via `CLOUDFLARE_API_TOKEN`. Treat local state as confidential (origin passwords and secret values). Commit `.terraform.lock.hcl` after `terraform init`.

**Not Terraform:** customer packages, bundle KV keys, Postgres catalog rows. Those are the deploy API.

## Runtime

Not Workers for Platforms. Customer packages are not persisted as account scripts and are not uploaded into a dispatch namespace.

Package code runs as a **Dynamic Worker** on `functhis-mcp` via a Worker Loader binding (`env.LOADER`). Implementation lives in `apps/mcp` (`src/execute.ts`); HTTP `search` / `execute` tools ship in phase 6.

- Authors write ordinary TypeScript; no required Functhis SDK. No author `wrangler.toml`.
- Optional `import { context, secret } from 'functhis:runtime'`. The host injects `./__functhis_runtime.mjs` at `LOADER.get` time (not in the published KV blob). Per-invocation context and secrets use AsyncLocalStorage inside that module. Published bundles must be built with a CLI that externalizes `functhis:runtime` and wraps handlers in `__runInRuntime`; republish after upgrading the runtime kernel. Hosted execute injects declared `secret()` names from organization and package ciphertext in Postgres (package overrides organization). The AES-GCM key is `FUNCTHIS_SECRETS_KEY` in Secrets Store. Local CLI still uses `functhis run --secret`. Editor types for that import ship in the public `functhis` npm package (`dist/index.d.ts`); function projects load them with `/// <reference types="functhis" />` after `npm install -D functhis`.
- One isolate per **package version** plus runtime kernel version. `LOADER.get(versionId:runtimeVersion, () => bundle + injected runtime)` reuses a warm isolate; `load()` is only for one-off try-it of unpublished code.
- Isolation: no parent `env`. Bindings the Dynamic Worker receives are explicit and empty in alpha.
- Limits on `getEntrypoint()`: `cpuMs` and `subRequests` from the caller’s plan. Fail closed.
- Network: omit `globalOutbound` in the loader config so Dynamic Workers use default outbound (tools wrap APIs in alpha). Later: host allowlist / intercept. Never inherit origin secrets (`env: {}`).
- Observability: Workers Analytics Engine data points per execute; Tail Worker / traces on `functhis-mcp` capture isolate logs.

Do not add a Workers for Platforms dispatch namespace unless custom-domain hostname routing later needs it. Dynamic Workers already cover isolation, per-invoke limits, warm reuse, and egress control.

## Source and bundles

Three layers. Do not collapse them.

```text
Source hash        deterministic hash of the published source tree (metadata only in alpha).
R2 artifact        canonical bundle.mjs, bundle.mjs.map, manifest.json, build.json, keyed by content hash.
KV bundle          hot copy of bundle.mjs for Worker Loader, keyed by bundle hash.
KV HOT             function pointers, domain search indexes, membership, JWKS for MCP.
Postgres catalog   ACL source of truth, slugs, currentVersionId, semver, execution rows (dashboard + miss-fill).
```

Publish:

```text
CLI → deploy API
  → discover + ts-morph contracts + esbuild ESM (local)
  → upload artifact (R2 canonical + KV copy of bundle.mjs)
  → insert immutable package_version (semver), point package.currentVersionId
```

**Author source (CLI discovery):** nearest `package.json` is the package. Function root is `"functhis"."root"`, else `src/`, else `functions/`, else shallow files at the package root. One default export per `.ts` / `.tsx` file; function slug from the path under the function root (kebab-case segments, so `src/support/extend-access.ts` → `support/extend-access`). Optional JSDoc description; optional `input` object parameter (TypeScript type → JSON Schema in `contract`). Public id: `@<scope>/<package>/<namespace…>/<function>`. Scope is a user handle or org slug. See [examples/README.md](examples/README.md).

Execute (MCP `execute`):

```text
ACL + quota on functhis-mcp (MCP execute tool)
  → functhis-mcp: LOADER.get(versionId, () => KV bundle)
  → getEntrypoint(null, { limits })
  → fetch()
  → execution row (+ Analytics Engine on mcp)
```

Execute is MCP `execute` on `functhis-mcp`.

```mermaid
sequenceDiagram
  participant CLI
  participant Web as functhis-web
  participant R2 as Artifacts R2
  participant KV as Bundles KV
  participant DB as Postgres
  participant Agent
  participant MCP as functhis-mcp
  participant DW as Dynamic Worker

  CLI->>Web: publish (device token)
  Web->>R2: PUT artifact (bundle, map, manifest, build.json)
  Web->>KV: PUT bundle.mjs copy
  Web->>DB: insert package_version, point currentVersionId
  Note over CLI,DB: later execute
  Agent->>MCP: execute @handle/pkg/fn
  MCP->>HOT: ACL + search docs
  MCP->>KV: load bundle by hash
  MCP->>DW: LOADER.get(versionId:runtimeVersion)
  DW-->>MCP: fetch result
  MCP->>DB: execution row
```

Rollback is `functhis rollback <semver>` (`currentVersionId` → that row). The loader id is the version id, so the isolate changes immediately. No rebuild.

Canonical source stays with the author (local tree / their Git). Functhis stores a published artifact (R2) and a KV hot copy of `bundle.mjs`. Git commit is optional provenance on `build.json`. Reuse is `execute` of a published function, not importing or forking source. Do not use Cloudflare Artifacts. Do not stand up a Git host for package trees.

R2 is the source of truth for the published artifact. KV is the execute hot path. R2 is also later used for large execution outputs (PDFs, archives), not as a Git host.

Do not copy Kody’s in-platform Git workspace or Gram’s third-party MCP Registry catalog. Functhis `search` domain `library` is later discovery of **our** published functions, not proxying other MCP servers.

## Data

Postgres metadata. Better Auth tables stay in `packages/db/src/schema/auth.ts`. After plugins: `oauthClient`, tokens, consent, JWT keys, `organization` / `member` / `invitation`.

| Table | Notes |
| --- | --- |
| `package` | `slug`, `ownerUserId`, required `organizationId`, `visibility` (`private` \| `organization` \| `library`), `currentVersionId` |
| `function` | `packageId`, `exportName`, `path`, `slug` (may include `/` namespaces), contract JSON, `search_text`. Unique `(packageId, slug)` |
| `package_version` | Immutable: semver, source hash, bundle hash, artifact key, contracts, git sha, runtime version, createdBy |
| `execution` | Thin: caller, status, cpu/ms, size. Retention-capped |

Local Docker is stock Postgres 16. Production is Neon Postgres. Workers use `drizzle-orm` + `pg` through Hyperdrive (`createDb` in `packages/db`). Migrations use `DATABASE_URL` from `packages/db/.env`, never Hyperdrive.

```mermaid
erDiagram
  user ||--o{ package : owns
  organization ||--o{ package : scopes
  package ||--o{ package_version : versions
  package ||--o{ function : functions
  package_version ||--o{ execution : runs
  function ||--o{ execution : optional
  user ||--o{ execution : caller

  package {
    text id PK
    text slug
    text owner_user_id
    text organization_id
    enum visibility
    text current_version_id
  }
  function {
    text id PK
    text package_id FK
    text slug
    jsonb contract
    text search_text
  }
  package_version {
    text id PK
    text source_hash
    text bundle_hash
    jsonb contracts
  }
  execution {
    text id PK
    text status
    int cpu_ms
  }
```

Owner handle (`@xmazu`) is unique. Default from GitHub username.

Package ACL (owner UI, MCP `search`, MCP `execute`):

```text
ownerUserId = me
or (organizationId in memberships and visibility = organization)
```

`private` is owner-only (org members do not inherit access). Every package requires an organization workspace; publish defaults to the caller’s sole org or `--scope <org-slug>`. MCP ids and catalog handles use the **organization slug**, not the owner’s user handle. Deploy API and owner UI set `visibility`; CLI: `--visibility`, `--scope`.

**Org migration (deploy):** SQL `0004` / `0005` backfill legacy user-scoped packages onto workspace orgs. If an owner’s handle slug is already taken by another workspace, migration creates `{handle}-workspace` instead of joining the foreign org. `0005` aborts when any package row still lacks `organization_id` (no silent deletes).

Billing: Better Auth Stripe plugin with `customerType: organization` (optional when Stripe secrets are unset). Entitlements (Free vs Pro package and execution caps) are enforced in `@functhis/publish` from Postgres subscription rows and `org_usage_period` counters—not from Stripe on the MCP hot path.

Quotas fail closed from day one: CPU, concurrency, request/response size.

## Repo

```text
apps/web          hosted origin: marketing, OAuth, /d owner UI, deploy API
apps/mcp          hosted: mcp.functhis.now, MCP tools + Worker Loader execute
apps/fumadocs     existing
packages/auth     createAuth, CIMD fetch, CLI client seed
packages/cli      OSS: login, publish, local run/dev
packages/db       schema
packages/api      shared oRPC / business logic (see below)
packages/publish   publish schemas, bundle hashing, catalog reads, execute helpers
packages/runtime  OSS: discover, contracts, bundle, worker template (later)
packages/protocol OSS: contract + search/execute types (later)
packages/infra    Terraform (flat .tf root) + Wrangler deploy/migrate scripts
```

**`packages/api` sharing rule:** shared oRPC and business logic for code that **more than one app** will call (web, MCP HTTP later). Do **not** put procedures or types that only one app uses there. App-only API stays in that app until a second consumer appears; then extract.

OSS: CLI, `runtime`, `protocol`. Hosted: auth, ACL, Dynamic Workers, MCP ids, quotas, history.

CLI: `functhis login` (device), `functhis publish`, `functhis rollback <semver>`, `functhis run` / `dev`. `deploy` remains a hidden alias of `publish`. No Docker. No author wrangler.toml.

## Flows

```text
Agent:  OAuth at functhis.now → consent on functhis.now
        POST mcp.functhis.now/mcp execute { id: "@xmazu/pkg/fn", arguments }
        → ACL → functhis-mcp → Dynamic Worker

Human:  /d owner UI (packages, orgs, copy MCP ids)

CLI:    login → functhis.now/device
        publish → artifact (R2 + KV) + package_version
        → MCP id @scope/package/namespace/function
```

## Defer

Billing, marketplace, library browse UX, invite email, Infisical, credential broker, custom domains, OpenAPI, workflows, Python, one MCP tool per function, `run.` hostname, public `@` function pages / HTTP try-it, Workers for Platforms, per-package Durable Objects, managed execution-output storage, Cloudflare Artifacts, source remix / import, proxying the MCP Registry.
