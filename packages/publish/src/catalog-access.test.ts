import { describe, expect, test } from 'bun:test';

import { member } from '@functhis/db/schema/auth';

import {
  canAccessPackage,
  buildPackageAccessContext,
  listMembershipOrganizationIds,
} from './catalog-access';
import { isMemberOfOrganization } from './org-membership-read';

const orgPkg = {
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
  visibility: 'organization' as const,
};

describe('canAccessPackage', () => {
  test('denies library visibility without a signed-in viewer', () => {
    expect(
      canAccessPackage(
        {
          organizationId: null,
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        { organizationIds: [], userId: null }
      )
    ).toBe(false);
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

  test('denies org workspace private packages for non-owner members', () => {
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

  test('library visibility does not grant access to strangers', () => {
    expect(
      canAccessPackage(
        {
          organizationId: 'org-1',
          ownerUserId: 'owner-1',
          visibility: 'library',
        },
        { organizationIds: [], userId: 'stranger' }
      )
    ).toBe(false);
  });
});

describe('isMemberOfOrganization', () => {
  test('true when a membership row exists', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          expect(table).toBe(member);
          return {
            where: () => ({
              limit: () => Promise.resolve([{ organizationId: 'org-1' }]),
            }),
          };
        },
      }),
    };
    await expect(
      isMemberOfOrganization(database as never, 'user-1', 'org-1')
    ).resolves.toBe(true);
  });

  test('false when no membership row exists', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    await expect(
      isMemberOfOrganization(database as never, 'user-1', 'org-1')
    ).resolves.toBe(false);
  });
});

describe('listMembershipOrganizationIds', () => {
  test('returns organization ids for the user', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          expect(table).toBe(member);
          return {
            where: () => Promise.resolve([{ organizationId: 'org-1' }]),
          };
        },
      }),
    };
    await expect(
      listMembershipOrganizationIds(database as never, 'user-1')
    ).resolves.toEqual(['org-1']);
  });
});

describe('buildPackageAccessContext', () => {
  test('returns an anonymous context when userId is null', async () => {
    await expect(buildPackageAccessContext({} as never, null)).resolves.toEqual(
      {
        organizationIds: [],
        userId: null,
      }
    );
  });

  test('loads memberships for an authenticated user', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ organizationId: 'org-2' }]),
        }),
      }),
    };
    await expect(
      buildPackageAccessContext(database as never, 'user-1')
    ).resolves.toEqual({
      organizationIds: ['org-2'],
      userId: 'user-1',
    });
  });
});
