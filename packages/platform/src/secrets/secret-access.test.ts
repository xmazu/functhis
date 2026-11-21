import { describe, expect, test } from 'bun:test';

import type { MembershipsPort } from '../ports';
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

const membershipsPort = (input: {
  organizationIds?: string[];
  role?: string | null;
}): MembershipsPort => ({
  isMemberOfOrganization: () =>
    Promise.resolve((input.organizationIds ?? []).length > 0),
  listMemberOrganizations: () => Promise.resolve([]),
  listOrganizationIds: () => Promise.resolve(input.organizationIds ?? []),
  memberRole: () => Promise.resolve(input.role ?? null),
  resolveOrganizationIdForMember: () => Promise.resolve(null),
  resolveOrganizationSlugById: () => Promise.resolve(null),
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
      canPublishPackage(membershipsPort({}), 'owner-1', packageRow)
    ).resolves.toBe(true);
  });

  test('allows organization members', async () => {
    await expect(
      canPublishPackage(
        membershipsPort({ organizationIds: ['org-1'] }),
        'member-1',
        packageRow
      )
    ).resolves.toBe(true);
  });

  test('denies strangers', async () => {
    await expect(
      canPublishPackage(
        membershipsPort({ organizationIds: [] }),
        'stranger',
        packageRow
      )
    ).resolves.toBe(false);
  });
});

describe('isOrgSecretsAdmin', () => {
  test('true for owner and admin memberships', async () => {
    await expect(
      isOrgSecretsAdmin(membershipsPort({ role: 'owner' }), 'user-1', 'org-1')
    ).resolves.toBe(true);
    await expect(
      isOrgSecretsAdmin(membershipsPort({ role: 'admin' }), 'user-1', 'org-1')
    ).resolves.toBe(true);
  });

  test('false for members and missing rows', async () => {
    await expect(
      isOrgSecretsAdmin(membershipsPort({ role: 'member' }), 'user-1', 'org-1')
    ).resolves.toBe(false);
    await expect(
      isOrgSecretsAdmin(membershipsPort({ role: null }), 'user-1', 'org-1')
    ).resolves.toBe(false);
  });
});

describe('canWritePackageSecrets', () => {
  test('allows publishers', async () => {
    await expect(
      canWritePackageSecrets(membershipsPort({}), 'owner-1', packageRow)
    ).resolves.toBe(true);
  });
});
