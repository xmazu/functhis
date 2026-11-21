import { formatFunctionId, parseFunctionId } from '../function-id';
import type { ParsedFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import type { HotCatalogSourcePort, MembershipsPort } from '../ports';
import { canAccessPackage } from './catalog-access';
import type { PackageAccessContext } from './catalog-access';
import { stripPackageFunctionIds } from './hot-index';
import {
  functionHotKey,
  functionHotKeyFromId,
  HOT_IDX_LIBRARY_KEY,
  HOT_TOMBSTONE_TTL_SECONDS,
  memberHotKey,
  mineIndexHotKey,
  orgIndexHotKey,
} from './hot-keys';
import type { PackageVisibility } from './package-visibility';

export interface HotFunctionDoc {
  availability?: 'degraded' | 'ready' | 'unavailable';
  bundleHash: string;
  contract: unknown;
  functionId: string;
  functionSlug: string;
  generation?: number;
  handle: string;
  hostAllowlist?: string[] | null;
  organizationId: string | null;
  ownerUserId: string;
  packageId: string;
  packageSlug: string;
  searchText: string;
  sourceCredentialName?: string;
  sourceEndpoint?: string;
  sourceKind?: 'hosted_function' | 'openapi_operation' | 'remote_mcp_tool';
  sourceMethod?: string;
  sourcePath?: string;
  strictOutput?: boolean;
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
  hotSource: HotCatalogSourcePort,
  packageId: string
): Promise<HotFunctionDoc[]> => {
  const projection = await hotSource.loadPackageProjection(packageId);
  if (!projection) {
    return [];
  }

  const { functions, handle, indexHandles, package: packageRow } = projection;
  const sourceKind =
    packageRow.sourceKind === 'openapi_operation' ||
    packageRow.sourceKind === 'remote_mcp_tool'
      ? packageRow.sourceKind
      : 'hosted_function';

  const docs: HotFunctionDoc[] = [];
  const newIds = await Promise.all(
    functions.map(async (row) => {
      const doc: HotFunctionDoc = {
        availability: 'ready',
        bundleHash: row.bundleHash,
        contract: row.contract,
        functionId: row.functionId,
        functionSlug: row.functionSlug,
        handle,
        hostAllowlist: row.hostAllowlist,
        organizationId: packageRow.organizationId,
        ownerUserId: packageRow.ownerUserId,
        packageId: packageRow.id,
        packageSlug: packageRow.slug,
        searchText: row.searchText ?? row.functionSlug,
        sourceKind,
        strictOutput: row.strictOutput ?? undefined,
        versionId: row.versionId,
        visibility: packageRow.visibility,
      };
      docs.push(doc);
      await writeHotFunctionDoc(hot, doc);
      return formatFunctionId({
        functionSlug: row.functionSlug,
        handle,
        packageSlug: packageRow.slug,
      });
    })
  );

  const mineKey = mineIndexHotKey(packageRow.ownerUserId);
  const mineIds = stripPackageFunctionIds(
    await readIndex(hot, mineKey),
    indexHandles,
    packageRow.slug
  );
  await writeIndex(hot, mineKey, [...mineIds, ...newIds]);

  if (packageRow.organizationId && packageRow.visibility === 'organization') {
    const orgKey = orgIndexHotKey(packageRow.organizationId);
    const orgIds = stripPackageFunctionIds(
      await readIndex(hot, orgKey),
      indexHandles,
      packageRow.slug
    );
    await writeIndex(hot, orgKey, [...orgIds, ...newIds]);
  }

  if (packageRow.visibility === 'library') {
    const libraryIds = stripPackageFunctionIds(
      await readIndex(hot, HOT_IDX_LIBRARY_KEY),
      indexHandles,
      packageRow.slug
    );
    await writeIndex(hot, HOT_IDX_LIBRARY_KEY, [...libraryIds, ...newIds]);
  }
  return docs;
};

export const getMembershipOrganizationIdsFromHot = async (
  hot: HotKvBinding,
  memberships: MembershipsPort,
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
  const organizationIds = await memberships.listOrganizationIds(userId);
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
  hotSource: HotCatalogSourcePort,
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

  const doc = await hotSource.loadFunctionDoc(parsed);
  if (!doc) {
    await tombstoneHotFunction(hot, parsed);
    return null;
  }

  await writeHotFunctionDoc(hot, doc);
  return doc;
};

export const buildAccessContextFromHot = async (
  hot: HotKvBinding,
  memberships: MembershipsPort,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (!userId) {
    return { organizationIds: [], userId: null };
  }
  const organizationIds = await getMembershipOrganizationIdsFromHot(
    hot,
    memberships,
    userId
  );
  return { organizationIds, userId };
};

export type SearchDomain = 'library' | 'mine' | 'org';

export const loadSearchFunctionIds = async (
  hot: HotKvBinding,
  hotSource: HotCatalogSourcePort,
  memberships: MembershipsPort,
  domain: SearchDomain,
  callerUserId: string
): Promise<string[]> => {
  const organizationIds = await getMembershipOrganizationIdsFromHot(
    hot,
    memberships,
    callerUserId
  );

  let indexKey: string | null = null;
  if (domain === 'mine') {
    indexKey = mineIndexHotKey(callerUserId);
  } else if (domain === 'library') {
    indexKey = HOT_IDX_LIBRARY_KEY;
  } else if (organizationIds.length > 0) {
    const indexChunks = await Promise.all(
      organizationIds.map((orgId) => readIndex(hot, orgIndexHotKey(orgId)))
    );
    const merged = indexChunks.flat();
    if (merged.length > 0) {
      return [...new Set(merged)];
    }
    return hotSource.listFunctionIds(domain, callerUserId, organizationIds);
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

  const fromDb = await hotSource.listFunctionIds(
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
  hotSource: HotCatalogSourcePort,
  ids: string[]
): Promise<HotFunctionDoc[]> => {
  const parsedIds = ids
    .map((id) => parseFunctionId(id))
    .filter((parsed): parsed is ParsedFunctionId => parsed !== null);
  const resolved = await Promise.all(
    parsedIds.map((parsed) => resolveHotFunctionDoc(hot, hotSource, parsed))
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

export const getMembershipOrganizationIdsFromHotKv = async (
  hot: HotKvBinding,
  userId: string
): Promise<string[]> => {
  const raw = await hot.get(memberHotKey(userId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as { organizationIds?: string[] };
    return Array.isArray(parsed.organizationIds) ? parsed.organizationIds : [];
  } catch {
    return [];
  }
};

export const buildAccessContextFromHotKv = async (
  hot: HotKvBinding,
  userId: string | null
): Promise<PackageAccessContext> => {
  if (!userId) {
    return { organizationIds: [], userId: null };
  }
  const organizationIds = await getMembershipOrganizationIdsFromHotKv(
    hot,
    userId
  );
  return { organizationIds, userId };
};

export const loadSearchFunctionIdsFromHot = async (
  hot: HotKvBinding,
  domain: SearchDomain,
  callerUserId: string
): Promise<string[]> => {
  const organizationIds = await getMembershipOrganizationIdsFromHotKv(
    hot,
    callerUserId
  );
  if (domain === 'mine') {
    return readIndex(hot, mineIndexHotKey(callerUserId));
  }
  if (domain === 'library') {
    return readIndex(hot, HOT_IDX_LIBRARY_KEY);
  }
  if (organizationIds.length === 0) {
    return [];
  }
  const indexChunks = await Promise.all(
    organizationIds.map((orgId) => readIndex(hot, orgIndexHotKey(orgId)))
  );
  return [...new Set(indexChunks.flat())];
};

export const loadHotFunctionDocsFromKv = async (
  hot: HotKvBinding,
  ids: readonly string[]
): Promise<HotFunctionDoc[]> => {
  const docs = await Promise.all(
    ids.map(async (id) => {
      const raw = await hot.get(functionHotKeyFromId(id));
      if (raw === null) {
        return null;
      }
      return parseHotFunctionDoc(raw);
    })
  );
  return docs.filter((doc): doc is HotFunctionDoc => doc !== null);
};
