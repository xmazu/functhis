import { afterEach, describe, expect, test } from 'bun:test';

import {
  capabilityGeneration,
  capabilitySource,
  execution,
  pkg,
  pkgFunction,
} from '@functhis/db/schema/catalog';
import { dispatchExecute } from '@functhis/mcp/execute-dispatch';
import { searchFunctionsWithContext } from '@functhis/mcp/search';
import { deterministicEmbedding } from '@functhis/publish/embedding';
import { formatFunctionId } from '@functhis/publish/function-id';
import { functionHotKeyFromId } from '@functhis/publish/hot-keys';
import {
  acceptOpenApiGeneration,
  importOpenApiSource,
} from '@functhis/publish/openapi-sync';
import { MemoryEmbeddingIndex } from '@functhis/publish/vectorize-index';
import { reconcileSearchIndexDebt } from '@functhis/publish/vectorize-upsert';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { stubGlobalFetch } from '../harness/fetch-stub';
import {
  createIntegrationMcpEnv,
  integrationHotBinding,
} from '../harness/mcp-env';
import { createMemoryHotKv } from '../harness/memory-hot-kv';
import { seedIntegrationPublishAuth } from '../harness/seed';
import openapiUsers from './fixtures/openapi-users.json';

describe('OpenAPI import through execute and analytics', () => {
  let restoreFetch: (() => void) | undefined;

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
  });

  test('imports, searches, executes with idempotency, and records selection analytics', async () => {
    const db = await integrationDb();
    const memoryHot = createMemoryHotKv();
    const hot = integrationHotBinding(memoryHot);
    const env = createIntegrationMcpEnv(memoryHot);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, organizationId, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );
    const sourceSlug = `openapi-${suffix}`;

    const first = await importOpenApiSource({
      database: db,
      hot,
      organizationId,
      ownerUserId: userId,
      slug: sourceSlug,
      spec: openapiUsers,
    });
    expect(first.drifted).toBe(false);
    expect(first.health).toBe('ready');

    const capabilityId = formatFunctionId({
      functionSlug: 'getuser',
      handle,
      packageSlug: sourceSlug,
    });

    const [packageRow] = await db
      .select({ sourceKind: pkg.sourceKind })
      .from(pkg)
      .where(eq(pkg.id, first.packageId))
      .limit(1);
    expect(packageRow?.sourceKind).toBe('openapi_operation');

    const functions = await db
      .select({ slug: pkgFunction.slug })
      .from(pkgFunction)
      .where(eq(pkgFunction.packageId, first.packageId));
    expect(functions.map((row) => row.slug)).toEqual(['getuser']);

    const hotDoc = await memoryHot.get(functionHotKeyFromId(capabilityId));
    expect(hotDoc).toContain('"sourceKind":"openapi_operation"');
    expect(hotDoc).toContain('"sourceEndpoint":"https://api.example.test"');
    expect(hotDoc).toContain('"/users/{id}"');

    const driftSpec = {
      ...openapiUsers,
      info: { ...openapiUsers.info, version: '1.0.1' },
    };
    const drifted = await importOpenApiSource({
      database: db,
      hot,
      organizationId,
      ownerUserId: userId,
      slug: sourceSlug,
      spec: driftSpec,
    });
    expect(drifted.drifted).toBe(true);
    expect(drifted.health).toBe('degraded');

    await acceptOpenApiGeneration({ database: db, sourceId: first.sourceId });
    const [sourceRow] = await db
      .select({ health: capabilitySource.health })
      .from(capabilitySource)
      .where(eq(capabilitySource.id, first.sourceId))
      .limit(1);
    expect(sourceRow?.health).toBe('ready');

    const index = new MemoryEmbeddingIndex();
    await reconcileSearchIndexDebt({
      env: { SENTRY_ENVIRONMENT: 'test' },
      hot,
      index,
    });

    const search = await searchFunctionsWithContext(
      {
        embedQueries: (texts) =>
          Promise.all(texts.map((text) => deterministicEmbedding(text))),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: 'fetch user profile' }
    );
    expect(search.results.some((hit) => hit.id === capabilityId)).toBe(true);

    let fetchCalls = 0;
    restoreFetch = stubGlobalFetch(() => {
      fetchCalls += 1;
      return Response.json({ id: '1' });
    });

    const idempotencyKey = `idem-${suffix}`;
    const executeInput = {
      arguments: { id: '1' },
      id: capabilityId,
      idempotencyKey,
    };

    const firstExecute = await dispatchExecute(env, userId, executeInput);
    expect(firstExecute.ok).toBe(true);
    expect(firstExecute.status).toBe(200);
    expect(fetchCalls).toBe(1);

    const replay = await dispatchExecute(env, userId, executeInput);
    expect(replay.ok).toBe(true);
    expect(fetchCalls).toBe(1);

    const mismatch = await dispatchExecute(env, userId, {
      ...executeInput,
      arguments: { id: '2' },
    });
    expect(mismatch.status).toBe(409);

    const executions = await db.select().from(execution);
    expect(executions.length).toBeGreaterThan(0);

    const generations = await db
      .select({ generation: capabilityGeneration.generation })
      .from(capabilityGeneration)
      .where(eq(capabilityGeneration.sourceId, first.sourceId));
    expect(generations.length).toBeGreaterThanOrEqual(2);
  });
});
