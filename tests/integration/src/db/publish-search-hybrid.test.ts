import { describe, expect, test } from 'bun:test';

import { searchFunctionsWithContext } from '@functhis/mcp/search';
import { readCatalogGeneration } from '@functhis/publish/catalog-generation';
import {
  deterministicEmbedding,
  CAPABILITY_VECTOR_KIND,
} from '@functhis/publish/embedding';
import { formatFunctionId } from '@functhis/publish/function-id';
import { loadGraphEdgesForSeeds } from '@functhis/publish/graph-hot';
import { functionHotKeyFromId } from '@functhis/publish/hot-keys';
import { MemoryEmbeddingIndex } from '@functhis/publish/vectorize-index';
import { reconcileSearchIndexDebt } from '@functhis/publish/vectorize-upsert';

import { integrationDb } from '../harness/db';
import { integrationHotBinding } from '../harness/mcp-env';
import { createMemoryHotKv } from '../harness/memory-hot-kv';
import { createMemoryBundles } from '../harness/memory-kv';
import { finalizePackage, startPackage } from '../harness/publish';
import { createIntegrationPublishContext } from '../harness/publish-context';
import { seedHotSearchCatalog } from '../harness/search-hot';
import { seedIntegrationPublishAuth } from '../harness/seed';

const exportPdfSearchText = 'export pdf document generation';

const manyExportFunctions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    functionSlug: `fn-${String(index).padStart(2, '0')}`,
    searchText: exportPdfSearchText,
  }));

describe('publish projection and hybrid search', () => {
  test('finalize projects catalog generation, graph aliases, and vector debt', async () => {
    const db = await integrationDb();
    const memoryHot = createMemoryHotKv();
    const hot = integrationHotBinding(memoryHot);
    const ctx = createIntegrationPublishContext(
      db,
      createMemoryBundles(),
      createMemoryBundles(),
      memoryHot
    );
    const suffix = crypto.randomUUID().slice(0, 8);
    const { accessToken, handle, organizationId, userId } =
      await seedIntegrationPublishAuth(db, suffix);
    const packageSlug = `pkg-${suffix}`;

    const startResponse = await startPackage(ctx, accessToken, {
      filesManifest: [{ bytes: 10, path: 'lookup.ts' }],
      slug: packageSlug,
    });
    expect(startResponse.status).toBe(200);
    const { packageId } = (await startResponse.json()) as { packageId: string };

    const finalizeResponse = await finalizePackage(ctx, accessToken, {
      contracts: [
        {
          contract: {
            description: 'Find a user by email',
            inputSchema: {
              properties: { email: { type: 'string' } },
              type: 'object',
            },
            reviewedAliases: ['customer'],
          },
          exportName: 'default',
          path: 'lookup.ts',
          slug: 'lookup',
        },
      ],
      packageId,
      slug: packageSlug,
    });
    expect(finalizeResponse.status).toBe(200);

    const capabilityId = formatFunctionId({
      functionSlug: 'lookup',
      handle,
      packageSlug,
    });

    expect(await readCatalogGeneration(hot, organizationId)).toBeGreaterThan(0);
    const aliasEdges = await loadGraphEdgesForSeeds(hot, ['alias:customer']);
    expect(aliasEdges[0]?.toId).toBe(capabilityId);

    const index = new MemoryEmbeddingIndex();
    expect(
      await reconcileSearchIndexDebt({
        env: { SENTRY_ENVIRONMENT: 'test' },
        hot,
        index,
      })
    ).toBeGreaterThan(0);

    const zeroOverlapQuery = 'find the client by mail';
    await index.upsert([
      {
        id: capabilityId,
        metadata: {
          kind: CAPABILITY_VECTOR_KIND,
          organizationId,
        },
        namespace: organizationId,
        values: deterministicEmbedding(zeroOverlapQuery),
      },
    ]);

    const exact = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: capabilityId }
    );
    expect(exact.results[0]?.id).toBe(capabilityId);

    const vector = await searchFunctionsWithContext(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: zeroOverlapQuery },
      { rerankScorer: () => Promise.resolve(null) }
    );
    expect(vector.results[0]?.id).toBe(capabilityId);

    const alias = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'customer' }
    );
    expect(alias.results[0]?.id).toBe(capabilityId);

    const hotDoc = await memoryHot.get(functionHotKeyFromId(capabilityId));
    expect(hotDoc).toContain('"sourceKind":"hosted_function"');
  });

  test('mock Jev rerank promotes a function after publish-shaped HOT seed', async () => {
    const db = await integrationDb();
    const memoryHot = createMemoryHotKv();
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, organizationId, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );

    await seedHotSearchCatalog(memoryHot, {
      functions: manyExportFunctions(12),
      handle,
      organizationId,
      ownerUserId: userId,
      packageSlug: 'tools',
    });

    const hot = integrationHotBinding(memoryHot);
    const winnerSlug = 'fn-11';
    const hits = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, domain: 'mine', query: 'export pdf' },
      {
        rerankScorer: (_query, cards) => {
          const scores = new Map<string, number>();
          for (const card of cards) {
            scores.set(card.id, card.functionSlug === winnerSlug ? 3.5 : 1);
          }
          return Promise.resolve(scores);
        },
      }
    );

    expect(hits.results[0]?.id).toBe(`@${handle}/tools/${winnerSlug}`);
  });
});
