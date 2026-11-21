import type { CatalogReadPort } from '../ports';
import { canAccessPackage } from './catalog-access';
import type { PackageAccessContext, PackageAccessRow } from './catalog-access';
import type { PackageVisibility } from './package-visibility';

export interface CatalogFunctionRow {
  contract: unknown;
  exportName: string;
  functionSlug: string;
  handle: string;
  id: string;
  packageId: string;
  packageSlug: string;
  path: string;
  visibility: 'library' | 'organization' | 'private';
}

export interface CatalogPackageRow {
  currentVersion: {
    publishedAt: Date;
    secretNames: string[];
    semver: string;
  };
  functions: CatalogFunctionRow[];
  handle: string;
  id: string;
  organizationId: string;
  ownerUserId: string;
  packageSlug: string;
  visibility: PackageVisibility;
}

export interface ExecutionSummaryRow {
  cpuMs: number | null;
  createdAt: Date;
  functionSlug: string | null;
  id: string;
  requestBytes: number | null;
  responseBytes: number | null;
  status: string;
}

export const canViewPackage = (
  packageRow: PackageAccessRow,
  context: PackageAccessContext
): boolean => canAccessPackage(packageRow, context);

export interface PackageListRow {
  functionCount: number;
  handle: string;
  id: string;
  organizationId: string;
  ownerUserId: string;
  packageSlug: string;
  sourceKind: string;
  visibility: PackageVisibility;
}

export type AccessiblePackageListRow = PackageListRow & {
  shared: boolean;
};

export const getPackageBySlugs = (
  read: CatalogReadPort,
  handle: string,
  packageSlug: string
): Promise<CatalogPackageRow | null> =>
  read.getPackageBySlugs(handle, packageSlug);

export const listOrgSharedPackages = (
  read: CatalogReadPort,
  organizationIds: readonly string[]
): Promise<PackageListRow[]> => read.listOrgSharedPackages(organizationIds);

export const getFunctionBySlugs = (
  read: CatalogReadPort,
  handle: string,
  packageSlug: string,
  functionSlug: string
): Promise<CatalogFunctionRow | null> =>
  read.getFunctionBySlugs(handle, packageSlug, functionSlug);

export const listOwnerPackages = (
  read: CatalogReadPort,
  ownerUserId: string
): Promise<PackageListRow[]> => read.listOwnerPackages(ownerUserId);

export const listAccessiblePackagesForUser = (
  read: CatalogReadPort,
  userId: string
): Promise<AccessiblePackageListRow[]> =>
  read.listAccessiblePackagesForUser(userId);

export const listPackageExecutions = (
  read: CatalogReadPort,
  packageId: string,
  options?: { limit?: number; retentionCutoff?: Date }
): Promise<ExecutionSummaryRow[]> =>
  read.listPackageExecutions(packageId, options);
