import type { Database } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { pkg, pkgFunction, packageVersion } from '@functhis/db/schema/catalog';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import {
  canAccessPackage,
  listMembershipOrganizationIds,
} from './catalog-access';
import type { PackageAccessContext } from './catalog-access';
import { formatFunctionId, parseFunctionId } from './function-id';
import type { ParsedFunctionId } from './function-id';
import {
  functionHotKey,
  functionHotKeyFromId,
  HOT_IDX_LIBRARY_KEY,
  HOT_TOMBSTONE_TTL_SECONDS,
  memberHotKey,
  mineIndexHotKey,
  orgIndexHotKey,
} from './hot-keys';
import type { HotKvBinding } from './http-context';
import { resolveOrganizationSlugById } from './org-membership-read';
import type { PackageVisibility } from './package-visibility';

export interface HotFunctionDoc {
  bundleHash: string;
  contract: unknown;
  functionId: string;
  functionSlug: string;
  handle: string;
  organizationId: string | null;
  ownerUserId: string;
  packageId: string;
  packageSlug: string;
  searchText: string;
  versionId: string;
  visibility: PackageVisibility;
}

export const parseHotFunctionDoc = (raw: string): HotFunctionDoc | null => {
  if (raw === '' || raw === '{}') {
    return null;
  }
  try {
    return JSON.parse(raw) as HotFunctionDoc;
  } catch {
    return null;
  }
};

const putJson = async (
  hot: HotKvBinding,
  key: string,
  value: unknown,
  options?: { expirationTtl?: number }
): Promise<void> => {
  await hot.put(key, JSON.stringify(value), options);
};

const readIndex = async (hot: HotKvBinding, key: string): Promise<string[]> => {
  const raw = await hot.get(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeIndex = async (
  hot: HotKvBinding,
  key: string,
  ids: string[]
): Promise<void> => {
  const unique = [...new Set(ids)];
  await putJson(hot, key, unique);
};

const functionIdPrefix = (handle: string, packageSlug: string): string =>
  `@${handle}/${packageSlug}/`;

const stripPackageFromIndex = (
  ids: string[],
  handle: string,
  packageSlug: string
): string[] => {
  const prefix = functionIdPrefix(handle, packageSlug);
  return ids.filter((id) => !id.startsWith(prefix));
};

export const writeHotFunctionDoc = async (
  hot: HotKvBinding,
  doc: HotFunctionDoc
): Promise<void> => {
  const id = formatFunctionId({
    functionSlug: doc.functionSlug,
    handle: doc.handle,
    packageSlug: doc.packageSlug,
  });
  await putJson(hot, functionHotKeyFromId(id), doc);
};

export const tombstoneHotFunction = async (
  hot: HotKvBinding,
  parsed: ParsedFunctionId
): Promise<void> => {
  await hot.put(functionHotKey(parsed), '{}', {
    expirationTtl: HOT_TOMBSTONE_TTL_SECONDS,
  });
};

export const syncPackageToHot = async (
  hot: HotKvBinding,
  database: Database,
  packageId: string
): Promise<void> => {
  const [packageRow] = await database
    .select()
    .from(pkg)
    .where(eq(pkg.id, packageId))
    .limit(1);
  if (!packageRow?.currentVersionId) {
    return;
  }

  const [owner] = await database
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, packageRow.ownerUserId))
    .limit(1);
  if (!owner?.handle) {
    return;
  }

  let { handle } = owner;
  if (packageRow.organizationId) {
    const orgHandle = await resolveOrganizationSlugById(
      database,
      packageRow.organizationId
    );
    if (orgHandle) {
      handle = orgHandle;
    }
  }

  const functions = await database
    .select({
      bundleHash: packageVersion.bundleHash,
      contract: pkgFunction.contract,
      functionId: pkgFunction.id,
      functionSlug: pkgFunction.slug,
      searchText: pkgFunction.searchText,
      versionId: packageVersion.id,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(packageVersion, eq(pkg.currentVersionId, packageVersion.id))
    .where(eq(pkg.id, packageId));

  const newIds = await Promise.all(
    functions.map(async (row) => {
      const doc: HotFunctionDoc = {
        bundleHash: row.bundleHash,
        contract: row.contract,
        functionId: row.functionId,
        functionSlug: row.functionSlug,
        handle,
        organizationId: packageRow.organizationId,
        ownerUserId: packageRow.ownerUserId,
        packageId: packageRow.id,
        packageSlug: packageRow.slug,
        searchText: row.searchText ?? row.functionSlug,
        versionId: row.versionId,
        visibility: packageRow.visibility,
      };
      await writeHotFunctionDoc(hot, doc);
      return formatFunctionId({
        functionSlug: row.functionSlug,
        handle,
        packageSlug: packageRow.slug,
      });
    })
  );

  const mineKey = mineIndexHotKey(packageRow.ownerUserId);
  const mineIds = stripPackageFromIndex(
    await readIndex(hot, mineKey),
    handle,
    packageRow.slug
  );
  await writeIndex(hot, mineKey, [...mineIds, ...newIds]);

  if (packageRow.organizationId && packageRow.visibility === 'organization') {
    const orgKey = orgIndexHotKey(packageRow.organizationId);
    const orgIds = stripPackageFromIndex(
      await readIndex(hot, orgKey),
      handle,
      packageRow.slug
    );
    await writeIndex(hot, orgKey, [...orgIds, ...newIds]);
  }

  if (packageRow.visibility === 'library') {
    const libraryIds = stripPackageFromIndex(
      await readIndex(hot, HOT_IDX_LIBRARY_KEY),
      handle,
      packageRow.slug
    );
    await writeIndex(hot, HOT_IDX_LIBRARY_KEY, [...libraryIds, ...newIds]);
  }
};

export const getMembershipOrganizationIdsFromHot = async (
  hot: HotKvBinding,
  database: Database,
  userId: string
): Promise<string[]> => {
  const raw = await hot.get(memberHotKey(userId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { organizationIds?: string[] };
      if (Array.isArray(parsed.organizationIds)) {
        return parsed.organizationIds;
      }
    } catch {
      // fall through to postgres
    }
  }
  const organizationIds = await listMembershipOrganizationIds(database, userId);
  await putJson(hot, memberHotKey(userId), { organizationIds });
  return organizationIds;
};

export const writeMembershipHot = async (
  hot: HotKvBinding,
  userId: string,
  organizationIds: string[]
): Promise<void> => {
  await putJson(hot, memberHotKey(userId), { organizationIds });
};

export const resolveHotFunctionDoc = async (
  hot: HotKvBinding,
  database: Database,
  parsed: ParsedFunctionId
): Promise<HotFunctionDoc | null> => {
  const key = functionHotKey(parsed);
  const cached = await hot.get(key);
  if (cached !== null) {
    const doc = parseHotFunctionDoc(cached);
    if (doc === null) {
      return null;
    }
    return doc;
  }

  const [row] = await database
    .select({
      bundleHash: packageVersion.bundleHash,
      contract: pkgFunction.contract,
      functionId: pkgFunction.id,
      functionSlug: pkgFunction.slug,
      handle: user.handle,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
      packageId: pkg.id,
      packageSlug: pkg.slug,
      searchText: pkgFunction.searchText,
      versionId: packageVersion.id,
      visibility: pkg.visibility,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(user, eq(pkg.ownerUserId, user.id))
    .innerJoin(packageVersion, eq(pkg.currentVersionId, packageVersion.id))
    .where(
      and(
        eq(user.handle, parsed.handle),
        eq(pkg.slug, parsed.packageSlug),
        eq(pkgFunction.slug, parsed.functionSlug)
      )
    )
    .limit(1);

  if (!row?.handle) {
    await tombstoneHotFunction(hot, parsed);
    return null;
  }

  const doc: HotFunctionDoc = {
    bundleHash: row.bundleHash,
    contract: row.contract,
    functionId: row.functionId,
    functionSlug: row.functionSlug,
    handle: row.handle,
    organizationId: row.organizationId,
    ownerUserId: row.ownerUserId,
    packageId: row.packageId,
    packageSlug: row.packageSlug,
    searchText: row.searchText ?? row.functionSlug,
    versionId: row.versionId,
    visibility: row.visibility,
  };
  await writeHotFunctionDoc(hot, doc);
  return doc;
};

export const buildAccessContextFromHot = async (
  hot: HotKvBinding,
  database: Database,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (!userId) {
    return { organizationIds: [], userId: null };
  }
  const organizationIds = await getMembershipOrganizationIdsFromHot(
    hot,
    database,
    userId
  );
  return { organizationIds, userId };
};

export type SearchDomain = 'library' | 'mine' | 'org';

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
        handle: user.handle,
        packageSlug: pkg.slug,
      })
      .from(pkgFunction)
      .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
      .innerJoin(user, eq(pkg.ownerUserId, user.id))
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
        handle: user.handle,
        packageSlug: pkg.slug,
      })
      .from(pkgFunction)
      .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
      .innerJoin(user, eq(pkg.ownerUserId, user.id))
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
      handle: user.handle,
      packageSlug: pkg.slug,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(user, eq(pkg.ownerUserId, user.id))
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

export const loadSearchFunctionIds = async (
  hot: HotKvBinding,
  database: Database,
  domain: SearchDomain,
  callerUserId: string
): Promise<string[]> => {
  const organizationIds = await getMembershipOrganizationIdsFromHot(
    hot,
    database,
    callerUserId
  );

  let indexKey: string | null = null;
  if (domain === 'mine') {
    indexKey = mineIndexHotKey(callerUserId);
  } else if (domain === 'library') {
    indexKey = HOT_IDX_LIBRARY_KEY;
  } else if (organizationIds.length > 0) {
    // org domain merges all org indexes
    const indexChunks = await Promise.all(
      organizationIds.map((orgId) => readIndex(hot, orgIndexHotKey(orgId)))
    );
    const merged = indexChunks.flat();
    if (merged.length > 0) {
      return [...new Set(merged)];
    }
    return loadFunctionIdsForDomainFromPostgres(
      database,
      domain,
      callerUserId,
      organizationIds
    );
  } else {
    return [];
  }

  if (!indexKey) {
    return [];
  }

  const ids = await readIndex(hot, indexKey);
  if (ids.length > 0) {
    return ids;
  }

  const fromDb = await loadFunctionIdsForDomainFromPostgres(
    database,
    domain,
    callerUserId,
    organizationIds
  );
  if (fromDb.length > 0) {
    await writeIndex(hot, indexKey, fromDb);
  }
  return fromDb;
};

export const loadHotFunctionDocsByIds = async (
  hot: HotKvBinding,
  database: Database,
  ids: string[]
): Promise<HotFunctionDoc[]> => {
  const parsedIds = ids
    .map((id) => parseFunctionId(id))
    .filter((parsed): parsed is ParsedFunctionId => parsed !== null);
  const resolved = await Promise.all(
    parsedIds.map((parsed) => resolveHotFunctionDoc(hot, database, parsed))
  );
  return resolved.filter((doc): doc is HotFunctionDoc => doc !== null);
};

export const filterDocsByAccess = (
  docs: HotFunctionDoc[],
  accessContext: PackageAccessContext
): HotFunctionDoc[] =>
  docs.filter((doc) =>
    canAccessPackage(
      {
        organizationId: doc.organizationId,
        ownerUserId: doc.ownerUserId,
        visibility: doc.visibility,
      },
      accessContext
    )
  );
