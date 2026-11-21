import type {
  HotFunctionDoc,
  SearchDomain,
} from '@functhis/core/publish/catalog/hot-catalog';
import { formatFunctionId } from '@functhis/core/publish/function-id';
import type { ParsedFunctionId } from '@functhis/core/publish/function-id';
import type { PackageVisibility } from '@functhis/core/publish/package-visibility';
import type {
  HotCatalogSourcePort,
  PackageHotProjection,
} from '@functhis/core/publish/ports';

import { and, eq, inArray, isNotNull } from '../drizzle';
import type { Database } from '../index';
import { organization, user } from '../schema/auth';
import { pkg, pkgFunction, packageVersion } from '../schema/catalog';
import { resolveOrganizationSlugById } from './memberships';
import { toPackageRecord } from './package-record';

const loadFunctionIdsForDomainFromPostgres = async (
  database: Database,
  domain: SearchDomain,
  callerUserId: string,
  organizationIds: string[]
): Promise<string[]> => {
  if (domain === 'mine') {
    const rows = await database
      .select({
        functionSlug: pkgFunction.slug,
        handle: organization.slug,
        packageSlug: pkg.slug,
      })
      .from(pkgFunction)
      .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
      .innerJoin(organization, eq(pkg.organizationId, organization.id))
      .where(
        and(eq(pkg.ownerUserId, callerUserId), isNotNull(pkg.currentVersionId))
      );
    return rows.map((row) =>
      formatFunctionId({
        functionSlug: row.functionSlug,
        handle: row.handle,
        packageSlug: row.packageSlug,
      })
    );
  }
  if (domain === 'library') {
    const rows = await database
      .select({
        functionSlug: pkgFunction.slug,
        handle: organization.slug,
        packageSlug: pkg.slug,
      })
      .from(pkgFunction)
      .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
      .innerJoin(organization, eq(pkg.organizationId, organization.id))
      .where(
        and(eq(pkg.visibility, 'library'), isNotNull(pkg.currentVersionId))
      );
    return rows.map((row) =>
      formatFunctionId({
        functionSlug: row.functionSlug,
        handle: row.handle,
        packageSlug: row.packageSlug,
      })
    );
  }
  if (organizationIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({
      functionSlug: pkgFunction.slug,
      handle: organization.slug,
      packageSlug: pkg.slug,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(organization, eq(pkg.organizationId, organization.id))
    .where(
      and(
        inArray(pkg.organizationId, organizationIds),
        eq(pkg.visibility, 'organization'),
        isNotNull(pkg.currentVersionId)
      )
    );
  return rows.map((row) =>
    formatFunctionId({
      functionSlug: row.functionSlug,
      handle: row.handle,
      packageSlug: row.packageSlug,
    })
  );
};

const loadFunctionDocFromPostgres = async (
  database: Database,
  parsed: ParsedFunctionId
): Promise<HotFunctionDoc | null> => {
  const [row] = await database
    .select({
      bundleHash: packageVersion.bundleHash,
      contract: pkgFunction.contract,
      functionId: pkgFunction.id,
      functionSlug: pkgFunction.slug,
      handle: organization.slug,
      hostAllowlist: packageVersion.hostAllowlist,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
      packageId: pkg.id,
      packageSlug: pkg.slug,
      searchText: pkgFunction.searchText,
      sourceKind: pkg.sourceKind,
      strictOutput: packageVersion.strictOutput,
      versionId: packageVersion.id,
      visibility: pkg.visibility,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(organization, eq(pkg.organizationId, organization.id))
    .innerJoin(packageVersion, eq(pkg.currentVersionId, packageVersion.id))
    .where(
      and(
        eq(organization.slug, parsed.handle),
        eq(pkg.slug, parsed.packageSlug),
        eq(pkgFunction.slug, parsed.functionSlug)
      )
    )
    .limit(1);

  if (!row?.handle) {
    return null;
  }

  const resolvedSourceKind =
    row.sourceKind === 'openapi_operation' ||
    row.sourceKind === 'remote_mcp_tool'
      ? row.sourceKind
      : ('hosted_function' as const);

  return {
    availability: 'ready',
    bundleHash: row.bundleHash,
    contract: row.contract,
    functionId: row.functionId,
    functionSlug: row.functionSlug,
    handle: row.handle,
    hostAllowlist: row.hostAllowlist,
    organizationId: row.organizationId,
    ownerUserId: row.ownerUserId,
    packageId: row.packageId,
    packageSlug: row.packageSlug,
    searchText: row.searchText ?? row.functionSlug,
    sourceKind: resolvedSourceKind,
    strictOutput: row.strictOutput ?? undefined,
    versionId: row.versionId,
    visibility: row.visibility as PackageVisibility,
  };
};

const loadPackageProjectionFromPostgres = async (
  database: Database,
  packageId: string
): Promise<PackageHotProjection | null> => {
  const [packageRow] = await database
    .select()
    .from(pkg)
    .where(eq(pkg.id, packageId))
    .limit(1);
  if (!packageRow?.currentVersionId) {
    return null;
  }

  const handle = await resolveOrganizationSlugById(
    database,
    packageRow.organizationId
  );
  if (!handle) {
    return null;
  }

  const [ownerRow] = await database
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, packageRow.ownerUserId))
    .limit(1);
  const indexHandles = [
    ...new Set(
      [handle, ownerRow?.handle].filter((value): value is string =>
        Boolean(value)
      )
    ),
  ];

  const functions = await database
    .select({
      bundleHash: packageVersion.bundleHash,
      contract: pkgFunction.contract,
      functionId: pkgFunction.id,
      functionSlug: pkgFunction.slug,
      hostAllowlist: packageVersion.hostAllowlist,
      searchText: pkgFunction.searchText,
      strictOutput: packageVersion.strictOutput,
      versionId: packageVersion.id,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(packageVersion, eq(pkg.currentVersionId, packageVersion.id))
    .where(eq(pkg.id, packageId));

  return {
    functions: functions.map((row) => ({
      bundleHash: row.bundleHash,
      contract: row.contract,
      functionId: row.functionId,
      functionSlug: row.functionSlug,
      hostAllowlist: row.hostAllowlist,
      searchText: row.searchText,
      strictOutput: row.strictOutput,
      versionId: row.versionId,
    })),
    handle,
    indexHandles,
    package: toPackageRecord(packageRow),
  };
};

export const createHotCatalogSourcePort = (
  database: Database
): HotCatalogSourcePort => ({
  listFunctionIds(domain, callerUserId, organizationIds) {
    return loadFunctionIdsForDomainFromPostgres(
      database,
      domain,
      callerUserId,
      [...organizationIds]
    );
  },

  async listPackageIdsWithCurrentVersion() {
    const rows = await database
      .select({ id: pkg.id })
      .from(pkg)
      .where(isNotNull(pkg.currentVersionId));
    return rows.map((row) => row.id);
  },

  loadFunctionDoc(parsed) {
    return loadFunctionDocFromPostgres(database, parsed);
  },

  loadPackageProjection(packageId) {
    return loadPackageProjectionFromPostgres(database, packageId);
  },
});
