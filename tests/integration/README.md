# Backend integration tests

Strategy (layers, fast DB constraints, default chunk pattern): [`docs/integration-tests.md`](../docs/integration-tests.md). This file is the runbook.

`tests/integration` is a workspace package (`@functhis/integration-tests`) for fast Postgres composition tests. Unit tests stay in each package/app (`bun run test`). Worker smoke and browser e2e are not implemented yet.

## Test layers

| Layer | Command | What |
| --- | --- | --- |
| Package unit | `bun run test` | Auth, deploy, CLI, MCP handler edges |
| Fast DB | `bun run test:integration` | Deploy start → finalize against real Postgres |
| Worker smoke | later | Wrangler harness + Hyperdrive |
| E2E | later | Playwright |

## Run (daily)

```bash
bun run test:integration
```

Starts Docker Postgres (if needed), migrates the `integration` database, then runs `bun test src/db` in this package.

**Budget:** each DB test should finish in **~1 second or less** on a warm machine.

Re-run when Docker is already up and migrated:

```bash
bun run --filter @functhis/integration-tests test:integration
```

## Fast DB integration

In-process Node, **direct TCP** Postgres (`127.0.0.1:5432/integration`).

| Path | Role |
| --- | --- |
| `src/harness/env.ts` | `INTEGRATION_DATABASE_URL` + local-host guard |
| `src/harness/db.ts` | `createDbFromUrl` singleton + close (`@functhis/db/node-postgres`) |
| `src/harness/publish-context.ts` | `createIntegrationPublishContext` for publish HTTP handlers |
| `src/harness/seed.ts` | Integration user + CLI deploy bearer token |
| `src/harness/memory-kv.ts` | In-memory `BUNDLES.put` stub |
| `src/db/*.test.ts` | Fast Postgres composition chunks |

**Chunks:**

- **Deploy start → finalize** - opaque bearer auth, catalog rows, artifact store stub, semver, org scope.
- **Deploy rollback** - restore a previous semver by slug or package id.
- **MCP search ranking / rerank** - HOT catalog seed, lexical order, mocked Jev rerank via `searchFunctionsWithContext`.

Cleanup: `int_db_%` user handles and organization slugs only (see `src/harness/cleanup.ts`).

## Environment

| Variable | Default |
| --- | --- |
| `INTEGRATION_DATABASE_URL` | `postgres://functhis:functhis@127.0.0.1:5432/integration` |

Non-local database hosts are refused.

## Layout

```text
tests/integration/
  package.json
  scripts/migrate.ts
  src/harness/
  src/db/
```
