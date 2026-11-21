import { and, eq } from '../drizzle';
import type { Database } from '../index';
import { member } from '../schema/auth';

const secretAdminRoles = new Set(['admin', 'owner']);

export const isSecretAdminRole = (role: string): boolean =>
  secretAdminRoles.has(role);

export const listMembershipOrganizationIds = async (
  database: Pick<Database, 'select'>,
  userId: string
): Promise<string[]> => {
  const rows = await database
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.map((row) => row.organizationId);
};

export const canPublishPackageRow = async (
  database: Pick<Database, 'select'>,
  userId: string,
  packageRow: { organizationId: string; ownerUserId: string }
): Promise<boolean> => {
  if (packageRow.ownerUserId === userId) {
    return true;
  }

  const organizationIds = await listMembershipOrganizationIds(database, userId);
  return organizationIds.includes(packageRow.organizationId);
};

export const isOrgSecretsAdmin = async (
  database: Pick<Database, 'select'>,
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const [membership] = await database
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);

  return membership ? isSecretAdminRole(membership.role) : false;
};

export const canWritePackageSecrets = async (
  database: Pick<Database, 'select'>,
  userId: string,
  packageRow: { organizationId: string; ownerUserId: string }
): Promise<boolean> => {
  if (await canPublishPackageRow(database, userId, packageRow)) {
    return true;
  }
  return isOrgSecretsAdmin(database, userId, packageRow.organizationId);
};

export const isMemberOfOrganization = async (
  database: Pick<Database, 'select'>,
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
