import { describe, expect, test } from 'bun:test';

import { member, organization, user } from '@functhis/db/schema/auth';

import {
  hasPublishSharingInput,
  resolvePublishSharing,
  resolvePublishSharingForPublishStart,
  resolveOrganizationIdForMember,
  resolveOrganizationSlugById,
  resolveScopeHandle,
  updatePackageSharing,
} from './publish-sharing';

describe('hasPublishSharingInput', () => {
  test('false when both fields omitted', () => {
    expect(hasPublishSharingInput({})).toBe(false);
  });

  test('true when visibility or organizationSlug is set', () => {
    expect(hasPublishSharingInput({ visibility: 'library' })).toBe(true);
    expect(hasPublishSharingInput({ organizationSlug: 'acme' })).toBe(true);
    expect(hasPublishSharingInput({ scope: 'acme' })).toBe(true);
  });
});

describe('resolvePublishSharingForPublishStart', () => {
  test('preserves existing sharing when redeploy omits flags', async () => {
    const result = await resolvePublishSharingForPublishStart(
      {} as never,
      'user-1',
      {},
      {
        organizationId: 'org-1',
        scopeKind: 'user',
        visibility: 'organization',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        scopeKind: 'user',
        visibility: 'organization',
      },
    });
  });

  test('defaults new packages to private without org', async () => {
    const result = await resolvePublishSharingForPublishStart(
      {} as never,
      'user-1',
      {},
      null
    );
    expect(result).toEqual({
      ok: true,
      value: { organizationId: null, scopeKind: 'user', visibility: 'private' },
    });
  });

  test('merges visibility when patching an existing package', async () => {
    const result = await resolvePublishSharingForPublishStart(
      {} as never,
      'user-1',
      { visibility: 'library' },
      {
        organizationId: 'org-1',
        scopeKind: 'user',
        visibility: 'organization',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        scopeKind: 'user',
        visibility: 'library',
      },
    });
  });
});

describe('resolvePublishSharing', () => {
  test('requires organizationSlug when visibility is organization', async () => {
    const result = await resolvePublishSharing({} as never, 'user-1', {
      visibility: 'organization',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('scope');
    }
  });

  test('treats the owner handle as a user scope', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          expect(table).toBe(user);
          return {
            where: () => ({
              limit: () => Promise.resolve([{ handle: 'alice' }]),
            }),
          };
        },
      }),
    };
    const result = await resolvePublishSharing(database as never, 'user-1', {
      scope: 'alice',
      visibility: 'library',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: null,
        scopeKind: 'user',
        visibility: 'library',
      },
    });
  });

  test('resolves an organization scope for members', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          if (table === user) {
            return {
              where: () => ({
                limit: () => Promise.resolve([{ handle: 'alice' }]),
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
        scopeKind: 'organization',
        visibility: 'private',
      },
    });
  });

  test('rejects an unknown scope handle', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          if (table === user) {
            return {
              where: () => ({
                limit: () => Promise.resolve([{ handle: 'alice' }]),
              }),
            };
          }
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          };
        },
      }),
    };
    const result = await resolvePublishSharing(database as never, 'user-1', {
      scope: 'missing',
    });
    expect(result.ok).toBe(false);
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

  test('resolveOrganizationSlugById returns the slug', async () => {
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
});

describe('resolvePublishSharingForPublishStart', () => {
  test('forwards an existing package when a new scope is provided', async () => {
    const database = {
      select: () => ({
        from: (table: unknown) => {
          if (table === user) {
            return {
              where: () => ({
                limit: () => Promise.resolve([{ handle: 'alice' }]),
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
    const result = await resolvePublishSharingForPublishStart(
      database as never,
      'user-1',
      { scope: 'acme' },
      {
        organizationId: null,
        scopeKind: 'user',
        visibility: 'private',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-1',
        scopeKind: 'organization',
        visibility: 'private',
      },
    });
  });
});

describe('updatePackageSharing', () => {
  test('returns not found when the catalog row is missing', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };
    const result = await updatePackageSharing(
      database as never,
      'user-1',
      'alice',
      'tools',
      { visibility: 'library' }
    );
    expect(result).toEqual({ error: 'Package not found', ok: false });
  });
});
