import { describe, expect, test } from 'bun:test';

import {
  buildFederationIndex,
  queryFederationIndex,
  removeFederationCapabilityIds,
  upsertFederationDocs,
} from './federation-index';
import type { FederationDoc } from './federation-index';

const doc = (overrides?: Partial<FederationDoc>): FederationDoc => ({
  availability: 'ready',
  contract: {
    description: 'Find a user by email',
    inputSchema: {
      properties: { email: { type: 'string' } },
      type: 'object',
    },
    reviewedAliases: ['customer'],
  },
  functionSlug: 'users/search',
  handle: 'acme',
  organizationId: 'org-1',
  ownerUserId: 'user-1',
  packageSlug: 'crm',
  searchText: 'users/search\nFind a user by email\nemail',
  sourceKind: 'hosted_function',
  visibility: 'private',
  ...overrides,
});

const idsOf = (
  index: Parameters<typeof queryFederationIndex>[0],
  ranked: { capIdx: number }[]
): (string | undefined)[] =>
  ranked.map((row) => index.capabilities[row.capIdx]?.id);

describe('buildFederationIndex', () => {
  test('exact ids resolve through the exact map', () => {
    const index = buildFederationIndex('org-1', [doc()]);
    const hits = queryFederationIndex(index, {
      query: '@acme/crm/users/search',
    });
    expect(hits.exactHitIds.size).toBe(1);
    expect(idsOf(index, hits.ranked)).toEqual(['@acme/crm/users/search']);
  });

  test('reviewed aliases nominate the capability', () => {
    const index = buildFederationIndex('org-1', [doc()]);
    const hits = queryFederationIndex(index, { query: 'customer' });
    expect(hits.aliasHitIds.size).toBe(1);
    expect(idsOf(index, hits.ranked)[0]).toBe('@acme/crm/users/search');
  });

  test('synonym folds resolve client/mail to user/email', () => {
    const index = buildFederationIndex('org-1', [doc()]);
    const hits = queryFederationIndex(index, {
      query: 'find the client by mail',
    });
    expect(idsOf(index, hits.ranked)[0]).toBe('@acme/crm/users/search');
  });

  test('intent phrases match verb variants of the slug', () => {
    const index = buildFederationIndex('org-1', [doc()]);
    const hits = queryFederationIndex(index, {
      query: 'lookup user by email',
    });
    expect(idsOf(index, hits.ranked)[0]).toBe('@acme/crm/users/search');
  });

  test('graph spread nominates capabilities sharing an action', () => {
    const index = buildFederationIndex('org-1', [
      doc(),
      doc({
        contract: { description: 'Find an invoice by number' },
        functionSlug: 'invoices/search',
        packageSlug: 'billing',
        searchText: 'invoices/search\nFind an invoice by number\nnumber',
      }),
    ]);
    const hits = queryFederationIndex(index, { query: 'customer' });
    const ids = idsOf(index, hits.ranked);
    expect(ids[0]).toBe('@acme/crm/users/search');
    expect(ids).toContain('@acme/billing/invoices/search');
    const neighbor = hits.ranked.find(
      (row) =>
        index.capabilities[row.capIdx]?.id === '@acme/billing/invoices/search'
    );
    expect(neighbor?.graphBonus ?? 0).toBeGreaterThan(0);
  });

  test('unrelated queries return no nominations', () => {
    const index = buildFederationIndex('org-1', [doc()]);
    const hits = queryFederationIndex(index, {
      query: 'quantum flux calibration',
    });
    expect(hits.ranked).toEqual([]);
    expect(hits.exactHitIds.size).toBe(0);
  });

  test('docs without an organization are skipped', () => {
    const index = buildFederationIndex('org-1', [
      doc({ organizationId: null }),
    ]);
    expect(index.capabilities).toEqual([]);
  });
});

describe('tenant isolation', () => {
  test('an alias in org A never matches the org B index', () => {
    const indexA = buildFederationIndex('org-a', [
      doc({ organizationId: 'org-a' }),
    ]);
    const indexB = buildFederationIndex('org-b', [
      doc({
        contract: { description: 'Unrelated widget' },
        functionSlug: 'widgets/list',
        organizationId: 'org-b',
        packageSlug: 'widgets',
        searchText: 'widgets/list\nUnrelated widget',
      }),
    ]);
    expect(
      idsOf(indexA, queryFederationIndex(indexA, { query: 'customer' }).ranked)
    ).toEqual(['@acme/crm/users/search']);
    expect(queryFederationIndex(indexB, { query: 'customer' }).ranked).toEqual(
      []
    );
  });
});

describe('upsertFederationDocs', () => {
  test('merges fresh docs while keeping untouched rows searchable', () => {
    const first = buildFederationIndex('org-1', [doc()]);
    const merged = upsertFederationDocs('org-1', first, [
      doc({
        contract: { description: 'List users in the workspace' },
        functionSlug: 'users/list',
        searchText: 'users/list\nList users in the workspace',
      }),
    ]);
    expect(merged.capabilities).toHaveLength(2);
    expect(
      idsOf(
        merged,
        queryFederationIndex(merged, { query: 'find the client by mail' })
          .ranked
      )[0]
    ).toBe('@acme/crm/users/search');
    expect(
      idsOf(
        merged,
        queryFederationIndex(merged, { query: 'list users' }).ranked
      )[0]
    ).toBe('@acme/crm/users/list');
  });

  test('fresh docs replace rows with the same id', () => {
    const first = buildFederationIndex('org-1', [doc()]);
    const merged = upsertFederationDocs('org-1', first, [
      doc({
        contract: { description: 'Completely different capability' },
        searchText: 'rotated description without overlap tokens',
      }),
    ]);
    expect(merged.capabilities).toHaveLength(1);
    expect(
      queryFederationIndex(merged, { query: 'quantum flux calibration' }).ranked
    ).toEqual([]);
    expect(merged.capabilities[0]?.searchText).toBe(
      'rotated description without overlap tokens'
    );
  });

  test('builds from scratch without an existing index', () => {
    const merged = upsertFederationDocs('org-1', null, [doc()]);
    expect(merged.capabilities).toHaveLength(1);
  });

  test('returns the existing index when there is nothing to merge', () => {
    const first = buildFederationIndex('org-1', [doc()]);
    expect(upsertFederationDocs('org-1', first, [])).toBe(first);
  });

  test('removeFederationCapabilityIds drops matching rows', () => {
    const first = buildFederationIndex('org-1', [
      doc(),
      doc({ functionSlug: 'users/list', searchText: 'users/list' }),
    ]);
    const next = removeFederationCapabilityIds('org-1', first, [
      '@acme/crm/users/search',
    ]);
    expect(next?.capabilities).toHaveLength(1);
    expect(next?.capabilities[0]?.id).toBe('@acme/crm/users/list');
  });
});

describe('federation index latency', () => {
  test('warm p95 stays under 10ms for a 2,000-capability scope', () => {
    const docs = Array.from({ length: 2000 }, (_, index) =>
      doc({
        contract: {
          description: `Capability ${String(index)} processes records`,
          inputSchema: {
            properties: { recordId: { type: 'string' } },
            type: 'object',
          },
        },
        functionSlug: `fn-${String(index).padStart(4, '0')}`,
        packageSlug: `pkg-${String(Math.floor(index / 100))}`,
        searchText: `fn-${String(index).padStart(4, '0')}\nCapability ${String(index)} processes records\nrecordId`,
      })
    );
    const index = buildFederationIndex('org-1', docs);
    const queries = [
      'find capability 1500 by record',
      'customer',
      'fn-0042',
      'process records',
      'quantum flux calibration',
    ];
    for (const query of queries) {
      queryFederationIndex(index, { query });
    }
    const latencies: number[] = [];
    for (let round = 0; round < 60; round += 1) {
      for (const query of queries) {
        const started = performance.now();
        queryFederationIndex(index, { query });
        latencies.push(performance.now() - started);
      }
    }
    const sorted = latencies.toSorted((left, right) => left - right);
    const p95 =
      sorted[
        Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
      ] ?? 0;
    expect(p95).toBeLessThan(10);
  });
});
