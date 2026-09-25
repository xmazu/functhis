import { describe, expect, test } from 'bun:test';

import { member, organization } from '@functhis/db/schema/auth';

import {
  listMemberOrganizations,
  resolveOrganizationIdForMember,
  resolveOrganizationSlugById,
} from './org-membership-read';
import {
  hasPublishSharingInput,
  resolvePublishSharing,
  resolvePublishSharingForPublishStart,
  resolveScopeHandle,
} from './publish-sharing';

describe('hasPublishSharingInput', () => {
  test('false when both fields omitted', () => {
    expect(hasPublishSharingInput({})).toBe(false);
  });

  test('true when visibility or scope is set', () => {
    expect(hasPublishSharingInput({ visibility: 'library' })).toBe(true);
    expect(hasPublishSharingInput({ organizationSlug: 'acme' })).toBe(true);
    expect(hasPublishSharingInput({ scope: 'acme' })).toBe(true);
  });
});

describe('resolvePublishSharingForPublishStart', () => {
  test('preserves existing org sharing when redeploy omits flags', async () => {
    const result = await resolvePublishSharingForPublishStart(
      {} as never,
      'user-1',
      {},
      {
        organizationId: 'org-1',
        visibility: 'organization',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        visibility: 'organization',
      },
    });
  });

  test('requires a workspace when user has no orgs', async () => {
    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    const result = await resolvePublishSharingForPublishStart(
      database as never,
      'user-1',
      {},
      null
    );
    expect(result.ok).toBe(false);
  });
});

describe('resolvePublishSharing', () => {
  test('resolves the sole organization when scope is omitted', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          if (table === member) {
            return {
              innerJoin: () => ({
                where: () => Promise.resolve([{ id: 'org-1', slug: 'acme' }]),
              }),
            };
          }
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'org-1' }]),
              }),
            }),
          };
        },
      }),
    };
    const result = await resolvePublishSharing(database as never, 'user-1', {});
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        visibility: 'private',
      },
    });
  });

  test('resolves an organization scope for members', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          if (table === member) {
            return {
              innerJoin: () => ({
                where: () => ({
                  limit: () => Promise.resolve([{ id: 'org-1' }]),
                }),
              }),
            };
          }
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'org-1' }]),
              }),
            }),
          };
        },
      }),
    };
    const result = await resolvePublishSharing(database as never, 'user-1', {
      scope: 'acme',
      visibility: 'organization',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        visibility: 'organization',
      },
    });
  });
});

describe('resolveOrganization helpers', () => {
  test('resolveScopeHandle prefers scope over organizationSlug', () => {
    expect(resolveScopeHandle({ organizationSlug: 'old', scope: 'new' })).toBe(
      'new'
    );
  });

  test('resolveOrganizationIdForMember returns the membership row', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          expect(table).toBe(organization);
          return {
            innerJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(member);
              return {
                where: () => ({
                  limit: () => Promise.resolve([{ id: 'org-9' }]),
                }),
              };
            },
          };
        },
      }),
    };
    await expect(
      resolveOrganizationIdForMember(database as never, 'user-1', 'acme')
    ).resolves.toBe('org-9');
  });

  test('resolveOrganizationSlugById returns slug', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ slug: 'acme' }]),
          }),
        }),
      }),
    };
    await expect(
      resolveOrganizationSlugById(database as never, 'org-1')
    ).resolves.toBe('acme');
  });

  test('resolveOrganizationSlugById returns null when org is missing', async () => {
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
      resolveOrganizationSlugById(database as never, 'org-missing')
    ).resolves.toBeNull();
  });

  test('listMemberOrganizations returns joined rows', async () => {
    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ id: 'org-1', slug: 'acme' }]),
          }),
        }),
      }),
    };
    await expect(
      listMemberOrganizations(database as never, 'user-1')
    ).resolves.toEqual([{ id: 'org-1', slug: 'acme' }]);
  });
});
