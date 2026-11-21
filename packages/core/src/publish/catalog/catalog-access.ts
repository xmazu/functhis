import type { MembershipsPort } from '../ports';
import type { PackageVisibility } from './package-visibility';

export type { PackageVisibility } from './package-visibility';

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
  if (context.userId === null) {
    return false;
  }

  if (packageRow.ownerUserId === context.userId) {
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

export const listMembershipOrganizationIds = (
  memberships: MembershipsPort,
  userId: string
): Promise<string[]> => memberships.listOrganizationIds(userId);

export const buildPackageAccessContext = async (
  memberships: MembershipsPort,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (userId === null) {
    return { organizationIds: [], userId: null };
  }

  const organizationIds = await listMembershipOrganizationIds(
    memberships,
    userId
  );
  return { organizationIds, userId };
};
