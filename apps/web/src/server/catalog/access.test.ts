import { describe, expect, test } from 'bun:test';

import type { CatalogPackageRow } from '@functhis/publish';

import { evaluateCatalogAccess } from './access-policy';

const privateCatalog = (): CatalogPackageRow => ({
  currentVersion: {
    publishedAt: new Date('2025-01-01T00:00:00.000Z'),
    semver: '1.0.0',
  },
  functions: [],
  handle: 'alice',
  id: 'pkg-1',
  organizationId: null,
  ownerUserId: 'owner-1',
  packageSlug: 'demo',
  scopeKind: 'user',
  visibility: 'private',
});

const noViewer = { organizationIds: [] as string[], userId: null };

describe('evaluateCatalogAccess', () => {
  test('requires sign-in when there is no viewer', () => {
    const result = evaluateCatalogAccess(privateCatalog(), noViewer);

    expect(result).toEqual({ access: 'sign-in' });
  });

  test('returns not-found for signed-in non-owners on private packages', () => {
    const result = evaluateCatalogAccess(privateCatalog(), {
      organizationIds: [],
      userId: 'other-user',
    });

    expect(result.access).toBe('not-found');
  });

  test('allows owners', () => {
    const result = evaluateCatalogAccess(privateCatalog(), {
      organizationIds: [],
      userId: 'owner-1',
    });

    expect(result.access).toBe('allow');
  });
});
