import type { Database } from '@functhis/db';
import { member, organization } from '@functhis/db/schema/auth';
import { and, eq } from 'drizzle-orm';

export interface MemberOrganization {
  id: string;
  slug: string;
}

export const listMemberOrganizations = (
  database: Database,
  userId: string
): Promise<MemberOrganization[]> =>
  database
    .select({ id: organization.id, slug: organization.slug })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId));

export const isMemberOfOrganization = async (
  database: Database,
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const [row] = await database
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);

  return row !== undefined;
};

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
