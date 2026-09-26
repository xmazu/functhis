import type { Database } from '@functhis/db';
import { member } from '@functhis/db/schema/auth';
import { and, eq } from 'drizzle-orm';

import { listMembershipOrganizationIds } from './catalog-access';

const secretAdminRoles = new Set(['admin', 'owner']);

export const isSecretAdminRole = (role: string): boolean =>
  secretAdminRoles.has(role);

export const canPublishPackage = async (
  database: Database,
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
  database: Database,
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
  database: Database,
  userId: string,
  packageRow: { organizationId: string; ownerUserId: string }
): Promise<boolean> => {
  if (await canPublishPackage(database, userId, packageRow)) {
    return true;
  }
  return isOrgSecretsAdmin(database, userId, packageRow.organizationId);
};
