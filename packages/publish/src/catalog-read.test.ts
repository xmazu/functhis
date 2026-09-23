import { describe, expect, test } from 'bun:test';

import {
  canViewCatalogPage,
  canViewCatalogWithoutAuth,
  canViewPackage,
} from './catalog-read';

const noViewer = { organizationIds: [] as string[], userId: null };

describe('canViewPackage', () => {
  test('allows library visibility without a viewer', () => {
    expect(
      canViewPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        noViewer
      )
    ).toBe(true);
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
  test('relaxes private pages in development without a viewer', () => {
    expect(
      canViewCatalogPage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        noViewer,
        { relaxInDevelopment: true }
      )
    ).toBe(true);
  });

  test('still requires auth in production mode', () => {
    expect(
      canViewCatalogPage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        noViewer,
        { relaxInDevelopment: false }
      )
    ).toBe(false);
  });
});

describe('canViewCatalogWithoutAuth', () => {
  test('allows library visibility', () => {
    expect(
      canViewCatalogWithoutAuth({
        organizationId: null,
        ownerUserId: 'owner-1',
        visibility: 'library',
      })
    ).toBe(true);
  });

  test('matches dev relax for private packages', () => {
    expect(
      canViewCatalogWithoutAuth(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        { relaxInDevelopment: true }
      )
    ).toBe(true);
  });
});
