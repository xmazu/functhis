import { describe, expect, test } from 'bun:test';

import { member } from '@functhis/db/schema/auth';

import {
  canPublishPackage,
  canWritePackageSecrets,
  isOrgSecretsAdmin,
  isSecretAdminRole,
} from './secret-access';

const packageRow = {
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
};

const membershipDb = (rows: { organizationId?: string; role?: string }[]) => ({
  select: () => ({
    from: (table: unknown) => {
      expect(table).toBe(member);
      return {
        where: () => {
          const mapped = rows.map((row) => ({
            organizationId: row.organizationId ?? 'org-1',
            role: row.role ?? 'member',
          }));
          const result = Promise.resolve(mapped) as Promise<
            { organizationId: string; role: string }[]
          > & {
            limit: () => Promise<{ organizationId: string; role: string }[]>;
          };
          result.limit = () => Promise.resolve(mapped.slice(0, 1));
          return result;
        },
      };
    },
  }),
});

describe('isSecretAdminRole', () => {
  test('allows owner and admin', () => {
    expect(isSecretAdminRole('owner')).toBe(true);
    expect(isSecretAdminRole('admin')).toBe(true);
    expect(isSecretAdminRole('member')).toBe(false);
  });
});

describe('canPublishPackage', () => {
  test('allows the package owner without a membership lookup', async () => {
    await expect(
      canPublishPackage({} as never, 'owner-1', packageRow)
    ).resolves.toBe(true);
  });

  test('allows organization members', async () => {
    await expect(
      canPublishPackage(
        membershipDb([{ organizationId: 'org-1' }]) as never,
        'member-1',
        packageRow
      )
    ).resolves.toBe(true);
  });

  test('denies strangers', async () => {
    await expect(
      canPublishPackage(membershipDb([]) as never, 'stranger', packageRow)
    ).resolves.toBe(false);
  });
});

describe('isOrgSecretsAdmin', () => {
  test('true for owner and admin memberships', async () => {
    await expect(
      isOrgSecretsAdmin(
        membershipDb([{ role: 'owner' }]) as never,
        'user-1',
        'org-1'
      )
    ).resolves.toBe(true);
    await expect(
      isOrgSecretsAdmin(
        membershipDb([{ role: 'admin' }]) as never,
        'user-1',
        'org-1'
      )
    ).resolves.toBe(true);
  });

  test('false for members and missing rows', async () => {
    await expect(
      isOrgSecretsAdmin(
        membershipDb([{ role: 'member' }]) as never,
        'user-1',
        'org-1'
      )
    ).resolves.toBe(false);
    await expect(
      isOrgSecretsAdmin(membershipDb([]) as never, 'user-1', 'org-1')
    ).resolves.toBe(false);
  });
});

describe('canWritePackageSecrets', () => {
  test('allows publishers', async () => {
    await expect(
      canWritePackageSecrets({} as never, 'owner-1', packageRow)
    ).resolves.toBe(true);
  });
});
