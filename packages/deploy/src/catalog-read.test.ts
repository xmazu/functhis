import { describe, expect, test } from 'bun:test';

import { canViewCatalogPage, canViewPackage } from './catalog-read';

describe('canViewPackage', () => {
  test('allows library visibility without a viewer', () => {
    expect(
      canViewPackage({ ownerUserId: 'owner-1', visibility: 'library' }, null)
    ).toBe(true);
  });

  test('denies private packages without owner session', () => {
    expect(
      canViewPackage({ ownerUserId: 'owner-1', visibility: 'private' }, null)
    ).toBe(false);
  });

  test('allows private packages for the owner', () => {
    expect(
      canViewPackage(
        { ownerUserId: 'owner-1', visibility: 'private' },
        'owner-1'
      )
    ).toBe(true);
  });
});

describe('canViewCatalogPage', () => {
  test('relaxes private pages in development without a viewer', () => {
    expect(
      canViewCatalogPage(
        { ownerUserId: 'owner-1', visibility: 'private' },
        null,
        { relaxInDevelopment: true }
      )
    ).toBe(true);
  });

  test('still requires auth in production mode', () => {
    expect(
      canViewCatalogPage(
        { ownerUserId: 'owner-1', visibility: 'private' },
        null,
        { relaxInDevelopment: false }
      )
    ).toBe(false);
  });
});
