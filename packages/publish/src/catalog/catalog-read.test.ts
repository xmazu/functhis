import { describe, expect, test } from 'bun:test';

import { canViewPackage } from './catalog-read';

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
