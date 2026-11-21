import type { MembershipsPort } from '../ports';

export interface MemberOrganization {
  id: string;
  slug: string;
}

export const listMemberOrganizations = (
  memberships: MembershipsPort,
  userId: string
): Promise<MemberOrganization[]> => memberships.listMemberOrganizations(userId);

export const isMemberOfOrganization = (
  memberships: MembershipsPort,
  userId: string,
  organizationId: string
): Promise<boolean> =>
  memberships.isMemberOfOrganization(userId, organizationId);

export const resolveOrganizationIdForMember = (
  memberships: MembershipsPort,
  userId: string,
  organizationSlug: string
): Promise<string | null> =>
  memberships.resolveOrganizationIdForMember(userId, organizationSlug);

export const resolveOrganizationSlugById = (
  memberships: MembershipsPort,
  organizationId: string
): Promise<string | null> =>
  memberships.resolveOrganizationSlugById(organizationId);
