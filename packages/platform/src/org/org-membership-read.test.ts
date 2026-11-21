import { describe, expect, test } from 'bun:test';

import type { MembershipsPort } from '../ports';
import {
  isMemberOfOrganization,
  listMemberOrganizations,
  resolveOrganizationIdForMember,
  resolveOrganizationSlugById,
} from './org-membership-read';

const memberships = {
  isMemberOfOrganization: () => Promise.resolve(true),
  listMemberOrganizations: () =>
    Promise.resolve([{ id: 'org_1', slug: 'acme' }]),
  resolveOrganizationIdForMember: () => Promise.resolve('org_1'),
  resolveOrganizationSlugById: () => Promise.resolve('acme'),
} satisfies MembershipsPort;

describe('org-membership-read', () => {
  test('delegates to MembershipsPort', async () => {
    await expect(
      listMemberOrganizations(memberships, 'user_1')
    ).resolves.toEqual([{ id: 'org_1', slug: 'acme' }]);
    await expect(
      isMemberOfOrganization(memberships, 'user_1', 'org_1')
    ).resolves.toBe(true);
    await expect(
      resolveOrganizationIdForMember(memberships, 'user_1', 'acme')
    ).resolves.toBe('org_1');
    await expect(
      resolveOrganizationSlugById(memberships, 'org_1')
    ).resolves.toBe('acme');
  });
});
