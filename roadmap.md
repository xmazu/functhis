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
  - [x] `artifactsRepoName`, bundle hash, `currentVersionId`
  - [x] Unique handle (`@xmazu`)
  - [x] ACL: owner only

- [x] **3. Infra**
  - [x] Terraform: zone, custom domains, Neon connection secret, Hyperdrive configs, KV, Secrets Store
  - [ ] Analytics Engine datasets (with `functhis-runtime`, roadmap 4)
  - [x] Wrangler: `functhis-web` + `functhis-console` preview/production envs and Hyperdrive bindings
  - [ ] `functhis-runtime` Worker (roadmap 4)
  - [x] Artifacts namespace per env (`functhis-preview`, `functhis-production`) — `wrangler artifacts namespaces create`
  - [x] R2 remote state. Never manage the same resource in Terraform and Wrangler.

- [ ] **4. Runtime**
  - [ ] Worker Loader on `functhis-runtime` (`LOADER.get(versionId)`)
  - [ ] Deploy API: Artifacts commit → bundle → KV → `package_version`
  - [ ] Quotas fail closed (`cpuMs`, `subRequests`, size)
  - [ ] Service binding web → runtime

- [ ] **5. Public URLs + console**
  - [ ] `GET` / `POST` `functhis.now/@owner/package[/function]`
  - [ ] Thin console: list, URL, MCP snippet, executions

- [ ] **6. MCP**
  - [ ] `search` + `execute` at `mcp.functhis.now`
  - [ ] Ids = `@owner/package/function`
  - [ ] `mine` only

- [ ] **7. CLI**
  - [ ] `functhis login` (device)
  - [ ] `functhis deploy`
  - [ ] `functhis run` / `dev` via `packages/runtime`

- [ ] **8. Sharing**
  - [ ] Turn on org / library filters
  - [ ] Same ids, same two MCP tools
