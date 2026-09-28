import { describe, expect, test } from 'bun:test';

import { buildAuthoritativeEdges, reviewedAliasEdge } from './capability-graph';

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

describe('reviewedAliasEdge', () => {
  test('lowercases the alias node', () => {
    const edge = reviewedAliasEdge({
      alias: 'Customer',
      capabilityId: '@acme/crm/users/search',
      generation: 1,
      organizationId: 'org-1',
    });
    expect(edge.fromId).toBe('alias:customer');
    expect(edge.toId).toBe('@acme/crm/users/search');
    expect(edge.type).toBe('reviewed_alias');
  });
});
