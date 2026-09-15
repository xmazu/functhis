# Roadmap

Decisions: [architecture.md](architecture.md). Intent: [vision.md](vision.md).

## Alpha

Someone who is not us can: `functhis deploy`, open `https://functhis.now/@them/pkg/fn`, run it from the page, connect an agent to `mcp.functhis.now`, deploy a second version.

## Order

1. **Auth**
   - GitHub login
   - `jwt()` + `mcp()` + `cimd()` + `organization()` schema
   - Console login, consent, device pages (`apps/console`, issuer `console.functhis.now`)
   - CIMD-safe fetch on Workers (`global_fetch_strictly_public` + URL policy)
   - `.functhis.now` cookies
   - Well-known routes on the issuer

2. **Schema**
   - `package`, `function`, `package_version`, `execution`
   - `ownerUserId`, optional `organizationId`, `visibility`
   - `artifactsRepoName`, bundle hash, `currentVersionId`
   - Unique handle (`@xmazu`)
   - ACL: owner only

3. **Infra**
   - Terraform: zone, DNS, routes, Neon connection secret, Hyperdrive configs, KV, Secrets Store, Analytics Engine
   - Wrangler: `functhis-web` + `functhis-console` + `functhis-runtime`, Hyperdrive bindings
   - Artifacts namespace per env (`functhis-preview`, `functhis-production`)
   - R2 remote state. Never manage the same resource in Terraform and Wrangler.

4. **Runtime**
   - Worker Loader on `functhis-runtime` (`LOADER.get(versionId)`)
   - Deploy API: Artifacts commit → bundle → KV → `package_version`
   - Quotas fail closed (`cpuMs`, `subRequests`, size)
   - Service binding web → runtime

5. **Public URLs + console**
   - `GET` / `POST` `functhis.now/@owner/package[/function]`
   - Thin console: list, URL, MCP snippet, executions

6. **MCP**
   - `search` + `execute` at `mcp.functhis.now`
   - Ids = `@owner/package/function`
   - `mine` only

7. **CLI**
   - `functhis login` (device)
   - `functhis deploy`
   - `functhis run` / `dev` via `packages/runtime`

8. **Sharing**
   - Turn on org / library filters
   - Same ids, same two MCP tools
