import { describe, expect, test } from 'bun:test';

import { canAccessPackage } from './catalog-access';

const orgPkg = {
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
  visibility: 'organization' as const,
};

describe('canAccessPackage', () => {
  test('allows library visibility without a viewer', () => {
    expect(
      canAccessPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        { organizationIds: [], userId: null }
      )
    ).toBe(true);
  });

  test('denies private packages without owner session', () => {
    expect(
      canAccessPackage(
        {
          organizationId: 'org-1',
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        { organizationIds: ['org-1'], userId: 'member-1' }
      )
    ).toBe(false);
  });

  test('allows private packages for the owner', () => {
    expect(
      canAccessPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'private',
        },
        { organizationIds: [], userId: 'owner-1' }
      )
    ).toBe(true);
  });

  test('allows organization packages for org members', () => {
    expect(
      canAccessPackage(orgPkg, {
        organizationIds: ['org-1'],
        userId: 'member-1',
      })
    ).toBe(true);
  });

  test('denies organization packages for non-members', () => {
    expect(
      canAccessPackage(orgPkg, {
        organizationIds: ['org-2'],
        userId: 'member-1',
      })
    ).toBe(false);
  });

  test('treats organization visibility with null organizationId as private', () => {
    expect(
      canAccessPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'organization',
        },
        { organizationIds: ['org-1'], userId: 'member-1' }
      )
    ).toBe(false);
  });

  test('library visibility is visible to non-members', () => {
    expect(
      canAccessPackage(
        {
          organizationId: 'org-1',
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        { organizationIds: [], userId: 'stranger' }
      )
    ).toBe(true);
  });
});
