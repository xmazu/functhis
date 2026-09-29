import { describe, expect, test } from 'bun:test';

import { searchFunctionsWithContext } from '@functhis/mcp/search';
import {
  CAPABILITY_VECTOR_KIND,
  deterministicEmbedding,
} from '@functhis/publish/embedding';
import { formatFunctionId } from '@functhis/publish/function-id';
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
  test('finalize projects vector debt', async () => {
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
        embedQueries: (texts) =>
          Promise.all(texts.map((text) => deterministicEmbedding(text))),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: zeroOverlapQuery },
      { rerankScorer: () => Promise.resolve(null) }
    );
    expect(vector.results[0]?.id).toBe(capabilityId);

    const synonym = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'find customer by email' }
    );
    expect(synonym.results[0]?.id).toBe(capabilityId);

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
