import type { Database } from '@functhis/db';
import { member } from '@functhis/db/schema/auth';
import { eq } from 'drizzle-orm';

export type PackageVisibility = 'library' | 'organization' | 'private';

export interface PackageAccessRow {
  organizationId: string | null;
  ownerUserId: string;
  visibility: PackageVisibility;
}

export interface PackageAccessContext {
  organizationIds: readonly string[];
  userId: string | null;
}

/**
 * Execution attribution: `callerUserId` on execute is the authenticated viewer when
 * present, otherwise null (e.g. anonymous library POST). Package ACL still uses
 * `canAccessPackage`; execution rows record who invoked, not who owns the package.
 */

export const canAccessPackage = (
  packageRow: PackageAccessRow,
  context: PackageAccessContext
): boolean => {
  if (packageRow.visibility === 'library') {
    return true;
  }

  if (context.userId !== null && packageRow.ownerUserId === context.userId) {
    return true;
  }

  if (packageRow.visibility === 'private') {
    return false;
  }

  if (packageRow.organizationId === null) {
    return false;
  }

  if (
    packageRow.visibility === 'organization' &&
    context.organizationIds.includes(packageRow.organizationId)
  ) {
    return true;
  }

  return false;
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

export const buildPackageAccessContext = async (
  database: Database,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (userId === null) {
    return { organizationIds: [], userId: null };
  }

  const organizationIds = await listMembershipOrganizationIds(database, userId);
  return { organizationIds, userId };
};
