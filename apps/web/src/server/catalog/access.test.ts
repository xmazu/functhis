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
  test('allows library packages without a viewer', () => {
    const catalog = privateCatalog();
    catalog.visibility = 'library';

    const result = evaluateCatalogAccess(catalog, noViewer, {
      relaxInDevelopment: false,
    });

    expect(result.access).toBe('allow');
  });

  test('denies private packages in production mode', () => {
    const result = evaluateCatalogAccess(privateCatalog(), noViewer, {
      relaxInDevelopment: false,
    });

    expect(result).toEqual({ access: 'sign-in' });
  });

  test('relaxes private packages in development when enabled', () => {
    const result = evaluateCatalogAccess(privateCatalog(), noViewer, {
      relaxInDevelopment: true,
    });

    expect(result.access).toBe('allow');
  });
});
