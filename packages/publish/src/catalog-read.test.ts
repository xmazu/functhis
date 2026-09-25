import { describe, expect, test } from 'bun:test';

import {
  canViewCatalogPage,
  canViewCatalogWithoutAuth,
  canViewPackage,
} from './catalog-read';

const noViewer = { organizationIds: [] as string[], userId: null };

describe('canViewPackage', () => {
  test('denies library visibility without a viewer', () => {
    expect(
      canViewPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        noViewer
      )
    ).toBe(false);
  });

  test('denies private packages without owner session', () => {
    expect(
      canViewPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        noViewer
      )
    ).toBe(false);
  });

  test('allows private packages for the owner', () => {
    expect(
      canViewPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        { organizationIds: [], userId: 'owner-1' }
      )
    ).toBe(true);
  });
});

describe('canViewCatalogPage', () => {
  test('requires auth for private pages without a viewer', () => {
    expect(
      canViewCatalogPage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        noViewer
      )
    ).toBe(false);
  });

  test('allows private pages for the owner', () => {
    expect(
      canViewCatalogPage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        { organizationIds: [], userId: 'owner-1' }
      )
    ).toBe(true);
  });
});

describe('canViewCatalogWithoutAuth', () => {
  test('denies library visibility without a session', () => {
    expect(
      canViewCatalogWithoutAuth({
        organizationId: null,
        ownerUserId: 'owner-1',
        visibility: 'library',
      })
    ).toBe(false);
  });

  test('denies private packages without a session', () => {
    expect(
      canViewCatalogWithoutAuth({
        organizationId: null,
        ownerUserId: 'owner-1',
        visibility: 'private',
      })
    ).toBe(false);
  });
});
