# Roadmap

Decisions: [architecture.md](architecture.md). Intent: [vision.md](vision.md).

## Alpha

Someone who is not us can: `functhis deploy`, open `https://functhis.now/@them/pkg/fn`, run it from the page, connect an agent to `mcp.functhis.now`, deploy a second version.

## Order

- [x] **1. Auth**
  - [x] GitHub login
  - [x] `jwt()` + `mcp()` + `cimd()` + `organization()` schema
  - [x] Console login, consent, device pages (`apps/console`, issuer `console.functhis.now`)
  - [x] CIMD-safe fetch on Workers (`global_fetch_strictly_public` + URL policy)
  - [x] `.functhis.now` cookies
  - [x] Well-known routes on the issuer

- [x] **2. Schema**
  - [x] `package`, `function`, `package_version`, `execution`
  - [x] `ownerUserId`, optional `organizationId`, `visibility`
  - [x] `sourceHash`, bundle hash, `currentVersionId`
  - [x] Unique handle (`@xmazu`)
  - [x] ACL: owner only

- [x] **3. Infra**
  - [x] Terraform: zone, custom domains, Neon connection secret, Hyperdrive configs, KV, Secrets Store
  - [x] `mcp.functhis.now` → `functhis-mcp` (not web)
  - [x] Wrangler: `functhis-web` + `functhis-console` + `functhis-mcp` preview/production env blocks
  - [x] R2 remote state. Never manage the same resource in Terraform and Wrangler.

- [x] **4. Deploy**
  - [x] Deploy API: `POST /api/deploy/start` + `POST /api/deploy/finalize` on web
  - [x] Source hash → bundle → KV → `package_version`
  - [x] Quota constants (`cpuMs`, `subRequests`, request/response size) in `@functhis/deploy`
  - [x] Hosted execute (phase 5 POST; phase 6 MCP done)

- [x] **5. Public URLs + console**
  - [x] `GET` / `POST` `functhis.now/@owner/package[/function]`
  - [x] Thin console: list, URL, MCP snippet, executions

- [x] **6. MCP** (`apps/mcp`)
  - [x] Worker app: `functhis-mcp`, Wrangler bindings (Hyperdrive, bundle KV, `LOADER`, Analytics Engine)
  - [x] Dynamic Worker execute helpers in `apps/mcp/src/execute.ts`
  - [x] `POST mcp.functhis.now/mcp` + OAuth protected resource
  - [x] Tools: `search` + `execute`
  - [x] Wire `execute` → `LOADER.get(versionId)` + execution rows + AE
  - [x] Ids = `@owner/package/function`; `mine` only

- [x] **7. CLI**
  - [x] `functhis login` (device)
  - [x] `functhis deploy`
  - [x] `functhis run` / `dev`

- [ ] **8. Sharing**
  - [ ] Turn on org / library filters
  - [ ] Same ids, same two MCP tools
