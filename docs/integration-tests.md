# Integration tests

**Status: Shipped.** Fast Postgres composition tests live in `@functhis/integration-tests`. This document is the strategy agents follow when adding or changing integration coverage. Commands, Docker, and environment variables stay in [`tests/integration/README.md`](../tests/integration/README.md).

## Layers

| Layer | Command | Purpose |
| --- | --- | --- |
| Package unit | `bun run test` | Auth, deploy helpers, CLI discover, MCP handler edges. Mock external boundaries. |
| Fast DB | `bun run test:integration` | Real Postgres, in-process production handlers/functions, stub Cloudflare KV and other I/O. |
| Worker / HTTP smoke | later | Wrangler `createTestHarness`, Hyperdrive, real KV bindings. |
| Browser e2e | later | Playwright against the site. Not implemented. |

Pick the lowest layer that proves the behavior. Do not push full deploy persistence into unit tests with mocked `fetch` when a single DB chunk is enough.

## Default pattern for API or server features

1. Seed an integration user (`int_db_*` handle prefix for cleanup).
2. Seed auth prerequisites (opaque deploy token, OAuth client rows) instead of driving GitHub or device login.
3. Call production handlers from `@functhis/publish/http` with `createIntegrationPublishContext` (database, stub KV, deploy auth).
4. Assert Postgres rows and any stubbed side effects (KV keys, etc.).

Use `createDbFromUrl` from `@functhis/db/node-postgres` against the dedicated `integration` database. Migrations use `migrateDatabaseFromUrl` from `@functhis/db/integration-migrate` (Drizzle migrator). Stub Cloudflare bindings in the test context; do not import `cloudflare:workers` in fast DB tests.

## Budget

Each test under `tests/integration/src/db/` should finish in about one second on a warm machine. If a scenario needs Wrangler, live `bun run dev`, or MCP Worker Loader execution, it belongs in a slower layer-not the DB project.

## Forbidden in fast DB chunks (`src/db/*.test.ts`)

- Wrangler test harness and live Workers dev
- `bun run dev` or HTTP to localhost app ports as the primary assertion path
- GitHub OAuth, device login, or real JWKS fetch to the site
- MCP `LOADER` execution or public `@handle/pkg/fn` POST execute
- `waitFor`, sleeps, or polling for async coordinator behavior
- Writing to the local `functhis` dev database (use `integration` only)

## Adding a new chunk

Copy an existing file in [`tests/integration/src/db/`](../tests/integration/src/db/). One focused test file per feature surface is enough. Update the chunk list in [`tests/integration/README.md`](../tests/integration/README.md) in the same change.
