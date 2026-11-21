import { describe, expect, test } from 'bun:test';

import type { MembershipsPort } from '../ports';
import { resolvePackagePublicHandle } from './package-public-handle';

describe('resolvePackagePublicHandle', () => {
  test('returns null when package has no organization', async () => {
    const memberships: MembershipsPort = {
      isMemberOfOrganization: () => Promise.resolve(false),
      listMemberOrganizations: () => Promise.resolve([]),
      listOrganizationIds: () => Promise.resolve([]),
      memberRole: () => Promise.resolve(null),
      resolveOrganizationIdForMember: () => Promise.resolve(null),
      resolveOrganizationSlugById: () => Promise.resolve(null),
    };
    await expect(resolvePackagePublicHandle(memberships, null)).resolves.toBe(
      null
    );
  });

  test('delegates to organization slug lookup', async () => {
    const memberships: MembershipsPort = {
      isMemberOfOrganization: () => Promise.resolve(false),
      listMemberOrganizations: () => Promise.resolve([]),
      listOrganizationIds: () => Promise.resolve([]),
      memberRole: () => Promise.resolve(null),
      resolveOrganizationIdForMember: () => Promise.resolve(null),
      resolveOrganizationSlugById: () => Promise.resolve('weselnemomenty'),
    };

    await expect(
      resolvePackagePublicHandle(memberships, 'org-1')
    ).resolves.toBe('weselnemomenty');
  });
});
