import type { Database } from '@functhis/db';
import { organization, user } from '@functhis/db/schema/auth';
import {
  execution,
  pkg,
  pkgFunction,
  packageVersion,
} from '@functhis/db/schema/catalog';
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
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
    semver: string;
  };
  functions: CatalogFunctionRow[];
  handle: string;
  id: string;
  organizationId: string | null;
  ownerUserId: string;
  packageSlug: string;
  scopeKind: 'organization' | 'user';
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

/** GET pages: in local dev, show private URLs without a web session (console cookies do not cross ports). */
export const canViewCatalogPage = (
  packageRow: PackageAccessRow,
  context: PackageAccessContext,
  options?: { relaxInDevelopment?: boolean }
): boolean => {
  if (canAccessPackage(packageRow, context)) {
    return true;
  }
  return Boolean(options?.relaxInDevelopment);
};

const anonymousViewer: PackageAccessContext = {
  organizationIds: [],
  userId: null,
};

/** GET/POST policy for callers without a session (library + optional dev relax). */
export const canViewCatalogWithoutAuth = (
  packageRow: PackageAccessRow,
  options?: { relaxInDevelopment?: boolean }
): boolean => canViewCatalogPage(packageRow, anonymousViewer, options);

export interface PackageListRow {
  functionCount: number;
  handle: string;
  id: string;
  organizationId: string | null;
  ownerUserId: string;
  packageSlug: string;
  scopeKind: 'organization' | 'user';
  visibility: PackageVisibility;
}

export type AccessiblePackageListRow = PackageListRow & {
  shared: boolean;
};

const packageHandleExpr = sql<string>`case when ${pkg.scopeKind} = 'organization' then ${organization.slug} else ${user.handle} end`;

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
      scopeKind: pkg.scopeKind,
      visibility: pkg.visibility,
    })
    .from(pkg)
    .innerJoin(user, eq(pkg.ownerUserId, user.id))
    .leftJoin(organization, eq(pkg.organizationId, organization.id))
    .leftJoin(pkgFunction, eq(pkgFunction.packageId, pkg.id))
    .where(where)
    .groupBy(
      pkg.id,
      user.handle,
      organization.slug,
      pkg.slug,
      pkg.visibility,
      pkg.organizationId,
      pkg.ownerUserId,
      pkg.scopeKind
    )
    .orderBy(pkg.slug);

  return rows;
};

export const getPackageBySlugs = async (
  database: Database,
  handle: string,
  packageSlug: string
): Promise<CatalogPackageRow | null> => {
  const [owner] = await database
    .select({ handle: user.handle, id: user.id })
    .from(user)
    .where(eq(user.handle, handle))
    .limit(1);

  const userScoped = owner
    ? await database
        .select({
          currentVersionId: pkg.currentVersionId,
          id: pkg.id,
          organizationId: pkg.organizationId,
          ownerUserId: pkg.ownerUserId,
          scopeKind: pkg.scopeKind,
          slug: pkg.slug,
          visibility: pkg.visibility,
        })
        .from(pkg)
        .where(
          and(
            eq(pkg.ownerUserId, owner.id),
            eq(pkg.slug, packageSlug),
            eq(pkg.scopeKind, 'user')
          )
        )
        .limit(1)
    : [];

  let [packageRow] = userScoped;
  let publicHandle = owner?.handle;

  if (!packageRow) {
    const [org] = await database
      .select({ id: organization.id, slug: organization.slug })
      .from(organization)
      .where(eq(organization.slug, handle))
      .limit(1);

    if (!org) {
      return null;
    }

    const [orgPackage] = await database
      .select({
        currentVersionId: pkg.currentVersionId,
        id: pkg.id,
        organizationId: pkg.organizationId,
        ownerUserId: pkg.ownerUserId,
        scopeKind: pkg.scopeKind,
        slug: pkg.slug,
        visibility: pkg.visibility,
      })
      .from(pkg)
      .where(
        and(
          eq(pkg.organizationId, org.id),
          eq(pkg.slug, packageSlug),
          eq(pkg.scopeKind, 'organization')
        )
      )
      .limit(1);

    packageRow = orgPackage;
    publicHandle = org.slug;
  }

  if (!packageRow?.id || !packageRow.currentVersionId || !publicHandle) {
    return null;
  }

  const [versionRow] = await database
    .select({
      createdAt: packageVersion.createdAt,
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
    scopeKind: packageRow.scopeKind,
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
      or(
        and(eq(pkg.scopeKind, 'user'), eq(pkg.visibility, 'organization')),
        eq(pkg.scopeKind, 'organization')
      )
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
