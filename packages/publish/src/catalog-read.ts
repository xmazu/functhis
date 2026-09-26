import type { Database } from '@functhis/db';
import { organization } from '@functhis/db/schema/auth';
import {
  execution,
  pkg,
  pkgFunction,
  packageVersion,
} from '@functhis/db/schema/catalog';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import {
  canAccessPackage,
  listMembershipOrganizationIds,
} from './catalog-access';
import type {
  PackageAccessContext,
  PackageAccessRow,
  PackageVisibility,
} from './catalog-access';

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
  visibility: PackageVisibility;
}

export type AccessiblePackageListRow = PackageListRow & {
  shared: boolean;
};

const packageHandleExpr = sql<string>`${organization.slug}`;

const listPackagesGrouped = async (
  database: Database,
  where: SQL | undefined
): Promise<PackageListRow[]> => {
  const rows = await database
    .select({
      functionCount: sql<number>`count(${pkgFunction.id})`.mapWith(Number),
      handle: packageHandleExpr,
      id: pkg.id,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
      packageSlug: pkg.slug,
      visibility: pkg.visibility,
    })
    .from(pkg)
    .innerJoin(organization, eq(pkg.organizationId, organization.id))
    .leftJoin(pkgFunction, eq(pkgFunction.packageId, pkg.id))
    .where(where)
    .groupBy(
      pkg.id,
      organization.slug,
      pkg.slug,
      pkg.visibility,
      pkg.organizationId,
      pkg.ownerUserId
    )
    .orderBy(pkg.slug);

  return rows;
};

export const getPackageBySlugs = async (
  database: Database,
  handle: string,
  packageSlug: string
): Promise<CatalogPackageRow | null> => {
  const [org] = await database
    .select({ id: organization.id, slug: organization.slug })
    .from(organization)
    .where(eq(organization.slug, handle))
    .limit(1);

  if (!org) {
    return null;
  }

  const [packageRow] = await database
    .select({
      currentVersionId: pkg.currentVersionId,
      id: pkg.id,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
      slug: pkg.slug,
      visibility: pkg.visibility,
    })
    .from(pkg)
    .where(and(eq(pkg.organizationId, org.id), eq(pkg.slug, packageSlug)))
    .limit(1);

  const publicHandle = org.slug;

  if (!packageRow?.id || !packageRow.currentVersionId || !publicHandle) {
    return null;
  }

  const [versionRow] = await database
    .select({
      createdAt: packageVersion.createdAt,
      secretNames: packageVersion.secretNames,
      semver: packageVersion.semver,
    })
    .from(packageVersion)
    .where(eq(packageVersion.id, packageRow.currentVersionId))
    .limit(1);

  if (!versionRow) {
    return null;
  }

  const functions = await database
    .select({
      contract: pkgFunction.contract,
      exportName: pkgFunction.exportName,
      functionSlug: pkgFunction.slug,
      id: pkgFunction.id,
      path: pkgFunction.path,
    })
    .from(pkgFunction)
    .where(eq(pkgFunction.packageId, packageRow.id));

  return {
    currentVersion: {
      // `package_version` has no separate published_at; version row creation time is the catalog publish instant.
      publishedAt: versionRow.createdAt,
      secretNames: versionRow.secretNames,
      semver: versionRow.semver,
    },
    functions: functions.map((fn) => ({
      contract: fn.contract,
      exportName: fn.exportName,
      functionSlug: fn.functionSlug,
      handle: publicHandle,
      id: fn.id,
      packageId: packageRow.id,
      packageSlug: packageRow.slug,
      path: fn.path,
      visibility: packageRow.visibility,
    })),
    handle: publicHandle,
    id: packageRow.id,
    organizationId: packageRow.organizationId,
    ownerUserId: packageRow.ownerUserId,
    packageSlug: packageRow.slug,
    visibility: packageRow.visibility,
  };
};

export const listOrgSharedPackages = (
  database: Database,
  organizationIds: readonly string[]
): Promise<PackageListRow[]> => {
  if (organizationIds.length === 0) {
    return Promise.resolve([]);
  }

  return listPackagesGrouped(
    database,
    and(
      isNotNull(pkg.currentVersionId),
      inArray(pkg.organizationId, [...organizationIds]),
      eq(pkg.visibility, 'organization')
    )
  );
};

export const getFunctionBySlugs = async (
  database: Database,
  handle: string,
  packageSlug: string,
  functionSlug: string
): Promise<CatalogFunctionRow | null> => {
  const catalog = await getPackageBySlugs(database, handle, packageSlug);
  if (!catalog) {
    return null;
  }

  return (
    catalog.functions.find((fn) => fn.functionSlug === functionSlug) ?? null
  );
};

export const listOwnerPackages = (
  database: Database,
  ownerUserId: string
): Promise<PackageListRow[]> =>
  listPackagesGrouped(
    database,
    and(eq(pkg.ownerUserId, ownerUserId), isNotNull(pkg.currentVersionId))
  );

export const listAccessiblePackagesForUser = async (
  database: Database,
  userId: string
): Promise<AccessiblePackageListRow[]> => {
  const owned = await listOwnerPackages(database, userId);
  const organizationIds = await listMembershipOrganizationIds(database, userId);
  const shared = await listOrgSharedPackages(database, organizationIds);
  const ownedIds = new Set(owned.map((row) => row.id));
  const merged: AccessiblePackageListRow[] = [
    ...owned.map((row) => ({ ...row, shared: false as const })),
    ...shared
      .filter((row) => !ownedIds.has(row.id))
      .map((row) => ({ ...row, shared: true as const })),
  ];
  return merged.toSorted((a, b) => a.packageSlug.localeCompare(b.packageSlug));
};

export const listRecentExecutions = async (
  database: Database,
  ownerUserId: string,
  packageId?: string,
  limit = 20
): Promise<ExecutionSummaryRow[]> => {
  const conditions = [eq(pkg.ownerUserId, ownerUserId)];
  if (packageId) {
    conditions.push(eq(pkg.id, packageId));
  }

  const rows = await database
    .select({
      cpuMs: execution.cpuMs,
      createdAt: execution.createdAt,
      functionSlug: pkgFunction.slug,
      id: execution.id,
      requestBytes: execution.requestBytes,
      responseBytes: execution.responseBytes,
      status: execution.status,
    })
    .from(execution)
    .innerJoin(
      packageVersion,
      eq(execution.packageVersionId, packageVersion.id)
    )
    .innerJoin(pkg, eq(packageVersion.packageId, pkg.id))
    .leftJoin(pkgFunction, eq(execution.functionId, pkgFunction.id))
    .where(and(...conditions))
    .orderBy(desc(execution.createdAt))
    .limit(limit);

  return rows;
};
