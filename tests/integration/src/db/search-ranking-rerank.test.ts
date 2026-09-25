import { describe, expect, test } from 'bun:test';

import { searchFunctionsWithContext } from '@functhis/mcp/search';

import { integrationDb } from '../harness/db';
import { createMemoryHotKv } from '../harness/memory-hot-kv';
import { seedHotSearchCatalog } from '../harness/search-hot';
import { seedIntegrationPublishAuth } from '../harness/seed';

const exportPdfSearchText = 'export pdf document generation';

const manyExportFunctions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    functionSlug: `fn-${String(index).padStart(2, '0')}`,
    searchText: exportPdfSearchText,
  }));

describe('MCP search ranking and rerank', () => {
  test('returns lexical order when rerank is skipped for a small pool', async () => {
    const db = await integrationDb();
    const hot = createMemoryHotKv();
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, userId } = await seedIntegrationPublishAuth(db, suffix);

    await seedHotSearchCatalog(hot, {
      functions: manyExportFunctions(8),
      handle,
      ownerUserId: userId,
      packageSlug: 'tools',
    });

    const hits = await searchFunctionsWithContext(
      { database: db, hot },
      { callerUserId: userId, domain: 'mine', query: 'export pdf' }
    );

    expect(hits.map((hit) => hit.id)).toEqual([
      `@${handle}/tools/fn-00`,
      `@${handle}/tools/fn-01`,
      `@${handle}/tools/fn-02`,
      `@${handle}/tools/fn-03`,
      `@${handle}/tools/fn-04`,
      `@${handle}/tools/fn-05`,
      `@${handle}/tools/fn-06`,
      `@${handle}/tools/fn-07`,
    ]);
  });

  test('mock Jev rerank promotes the chosen function over lexical order', async () => {
    const db = await integrationDb();
    const hot = createMemoryHotKv();
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, userId } = await seedIntegrationPublishAuth(db, suffix);

    await seedHotSearchCatalog(hot, {
      functions: manyExportFunctions(12),
      handle,
      ownerUserId: userId,
      packageSlug: 'tools',
    });

    const winnerSlug = 'fn-11';
    const hits = await searchFunctionsWithContext(
      { database: db, hot },
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

    expect(hits[0]?.id).toBe(`@${handle}/tools/${winnerSlug}`);
    expect(hits).toHaveLength(12);
  });

  test('mock Jev failure keeps stage-1 lexical order', async () => {
    const db = await integrationDb();
    const hot = createMemoryHotKv();
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, userId } = await seedIntegrationPublishAuth(db, suffix);

    await seedHotSearchCatalog(hot, {
      functions: manyExportFunctions(12),
      handle,
      ownerUserId: userId,
      packageSlug: 'tools',
    });

    const hits = await searchFunctionsWithContext(
      { database: db, hot },
      { callerUserId: userId, domain: 'mine', query: 'export pdf' },
      {
        rerankScorer: () => Promise.resolve(null),
      }
    );

    expect(hits[0]?.id).toBe(`@${handle}/tools/fn-00`);
    expect(hits[1]?.id).toBe(`@${handle}/tools/fn-01`);
  });
});
