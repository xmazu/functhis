import { describe, expect, test } from 'bun:test';

import {
  buildAuthoritativeEdges,
  graphNeighborBonus,
  reviewedAliasEdge,
  traverseGraphNeighbors,
} from './capability-graph';

describe('graphNeighborBonus', () => {
  test('penalizes high-degree nodes', () => {
    const low = graphNeighborBonus({
      confidence: 1,
      degree: 2,
      hop: 1,
      sourceReliability: 1,
      weight: 1,
    });
    const high = graphNeighborBonus({
      confidence: 1,
      degree: 64,
      hop: 1,
      sourceReliability: 1,
      weight: 1,
    });
    expect(low).toBeGreaterThan(high);
  });
});

describe('buildAuthoritativeEdges', () => {
  test('links org, package, namespace, action, and parameters', () => {
    const edges = buildAuthoritativeEdges({
      capabilityId: '@acme/crm/users/search',
      contract: {
        inputSchema: {
          properties: { email: { type: 'string' } },
          type: 'object',
        },
      },
      generation: 1,
      handle: 'acme',
      organizationId: 'org-1',
      packageSlug: 'crm',
      secretNames: ['CRM_TOKEN'],
      sourceKind: 'hosted_function',
    });
    expect(edges.some((edge) => edge.type === 'org_owns_package')).toBe(true);
    expect(edges.some((edge) => edge.type === 'namespace_contains')).toBe(true);
    expect(edges.some((edge) => edge.toId === 'param:email')).toBe(true);
    expect(edges.some((edge) => edge.fromId === 'secret:CRM_TOKEN')).toBe(true);
  });
});

describe('traverseGraphNeighbors', () => {
  test('reviewed aliases nominate a neighbor; inferred similar_to does not', () => {
    const target = '@acme/crm/users/search';
    const invoices = '@acme/billing/invoices/search';
    const alias = reviewedAliasEdge({
      alias: 'customer',
      capabilityId: target,
      generation: 1,
      organizationId: 'org-1',
    });
    const similar = {
      confidence: 0.4,
      fromId: 'seed',
      generation: 1,
      organizationId: 'org-1',
      provenance: 'inferred' as const,
      toId: invoices,
      type: 'similar_to' as const,
      weight: 1,
    };
    const bonus = traverseGraphNeighbors(
      [alias, similar],
      ['alias:customer', 'seed'],
      new Set([target, invoices, 'alias:customer', 'seed'])
    );
    expect(bonus.has(target)).toBe(true);
    expect(bonus.has(invoices)).toBe(false);
  });
});
