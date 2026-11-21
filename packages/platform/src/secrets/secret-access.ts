import type { MembershipsPort } from '../ports';

const secretAdminRoles = new Set(['admin', 'owner']);

export const isSecretAdminRole = (role: string): boolean =>
  secretAdminRoles.has(role);

export const canPublishPackage = async (
  memberships: MembershipsPort,
  userId: string,
  packageRow: { organizationId: string; ownerUserId: string }
): Promise<boolean> => {
  if (packageRow.ownerUserId === userId) {
    return true;
  }

  const organizationIds = await memberships.listOrganizationIds(userId);
  return organizationIds.includes(packageRow.organizationId);
};

export const isOrgSecretsAdmin = async (
  memberships: MembershipsPort,
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const role = await memberships.memberRole(userId, organizationId);
  return role ? isSecretAdminRole(role) : false;
};

export const canWritePackageSecrets = async (
  memberships: MembershipsPort,
  userId: string,
  packageRow: { organizationId: string; ownerUserId: string }
): Promise<boolean> => {
  if (await canPublishPackage(memberships, userId, packageRow)) {
    return true;
  }
  return isOrgSecretsAdmin(memberships, userId, packageRow.organizationId);
};
