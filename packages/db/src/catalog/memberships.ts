import type { MembershipsPort } from '@functhis/core/publish/ports';

import { and, eq } from '../drizzle';
import type { Database } from '../index';
import { member, organization } from '../schema/auth';

export const resolveOrganizationIdForMember = async (
  database: Database,
  userId: string,
  organizationSlug: string
): Promise<string | null> => {
  const [row] = await database
    .select({ id: organization.id })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(
      and(eq(organization.slug, organizationSlug), eq(member.userId, userId))
    )
    .limit(1);

  return row?.id ?? null;
};

export const resolveOrganizationSlugById = async (
  database: Database,
  organizationId: string
): Promise<string | null> => {
  const [row] = await database
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return row?.slug ?? null;
};

export const listMembershipOrganizationIds = async (
  database: Database,
  userId: string
): Promise<string[]> => {
  const rows = await database
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.map((row) => row.organizationId);
};

export const createMembershipsPort = (database: Database): MembershipsPort => ({
  async isMemberOfOrganization(userId, organizationId) {
    const [row] = await database
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId)
        )
      )
      .limit(1);

    return row !== undefined;
  },

  listMemberOrganizations(userId) {
    return database
      .select({ id: organization.id, slug: organization.slug })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId));
  },

  listOrganizationIds(userId) {
    return listMembershipOrganizationIds(database, userId);
  },

  async memberRole(userId, organizationId) {
    const [membership] = await database
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId)
        )
      )
      .limit(1);

    return membership?.role ?? null;
  },

  resolveOrganizationIdForMember(userId, organizationSlug) {
    return resolveOrganizationIdForMember(database, userId, organizationSlug);
  },

  resolveOrganizationSlugById(organizationId) {
    return resolveOrganizationSlugById(database, organizationId);
  },
});
