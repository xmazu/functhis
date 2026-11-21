/* eslint-disable no-await-in-loop -- sequential HOT doc writes per operation */
import { writeHotFunctionDoc } from '../catalog/hot-catalog';
import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { stripPackageFunctionIds } from '../catalog/hot-index';
import { mineIndexHotKey, orgIndexHotKey } from '../catalog/hot-keys';
import { projectHotDocsForSearch } from '../catalog/hot-search-projection';
import type { HotKvBinding } from '../http/http-context';
import type {
  HotCatalogSourcePort,
  MembershipsPort,
  SourceStorePort,
} from '../ports';
import { buildFunctionSearchText } from '../search/function-search-text';
import {
  extractOpenApiOperations,
  hashOpenApiSpec,
  openApiServerUrl,
} from './openapi-operations';

export type SourceHealth = 'degraded' | 'ready' | 'unavailable';

const asSpec = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

interface ImportOpenApiPersistResult {
  drifted: boolean;
  generation: number;
  health: SourceHealth;
  packageId: string;
  sourceId: string;
}

export const importOpenApiSource = async (input: {
  credentialName?: string;
  hot: HotKvBinding;
  hotSource: HotCatalogSourcePort;
  memberships: MembershipsPort;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  sources: SourceStorePort;
  spec: unknown;
}): Promise<ImportOpenApiPersistResult> => {
  const spec = asSpec(input.spec);
  if (!spec) {
    throw new Error('OpenAPI spec must be an object');
  }
  const endpoint = openApiServerUrl(spec);
  if (!endpoint) {
    throw new Error('OpenAPI spec is missing servers[0].url');
  }
  const operations = extractOpenApiOperations(spec);
  if (operations.length === 0) {
    throw new Error('OpenAPI spec has no operations');
  }
  const contractHash = await hashOpenApiSpec(spec);

  const result = (await input.sources.commitOpenApiImport({
    credentialName: input.credentialName,
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    slug: input.slug,
    spec,
  })) as ImportOpenApiPersistResult;

  if (result.drifted) {
    return result;
  }

  const handle = await input.memberships.resolveOrganizationSlugById(
    input.organizationId
  );
  if (!handle) {
    throw new Error('Organization handle is missing');
  }

  const projection = await input.hotSource.loadPackageProjection(
    result.packageId
  );
  const fnBySlug = new Map(
    (projection?.functions ?? []).map((fn) => [fn.functionSlug, fn])
  );

  const functionIds: string[] = [];
  const projectedDocs: HotFunctionDoc[] = [];
  for (const operation of operations) {
    const row = fnBySlug.get(operation.operationId);
    if (!row) {
      continue;
    }
    const doc: HotFunctionDoc = {
      availability: 'ready',
      bundleHash: `openapi:${contractHash}`,
      contract: {
        description: operation.description,
        inputSchema: operation.requestSchema,
      },
      functionId: row.functionId,
      functionSlug: operation.operationId,
      generation: result.generation,
      handle,
      hostAllowlist: [new URL(endpoint).hostname],
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      packageId: result.packageId,
      packageSlug: input.slug,
      searchText:
        buildFunctionSearchText({
          contract: {
            description: operation.description,
            inputSchema: operation.requestSchema,
          },
          slug: operation.operationId,
        }) || operation.operationId,
      sourceCredentialName: input.credentialName,
      sourceEndpoint: endpoint,
      sourceKind: 'openapi_operation',
      sourceMethod: operation.method,
      sourcePath: operation.path,
      versionId: row.versionId,
      visibility: 'organization',
    };
    await writeHotFunctionDoc(input.hot, doc);
    projectedDocs.push(doc);
    functionIds.push(`@${handle}/${input.slug}/${operation.operationId}`);
  }

  const orgKey = orgIndexHotKey(input.organizationId);
  const orgRaw = await input.hot.get(orgKey);
  const orgIds = orgRaw ? (JSON.parse(orgRaw) as string[]) : [];
  const stripped = stripPackageFunctionIds(orgIds, [handle], input.slug);
  await input.hot.put(orgKey, JSON.stringify([...stripped, ...functionIds]));
  const mineKey = mineIndexHotKey(input.ownerUserId);
  const mineRaw = await input.hot.get(mineKey);
  const mineIds = mineRaw ? (JSON.parse(mineRaw) as string[]) : [];
  const mineStripped = stripPackageFunctionIds(mineIds, [handle], input.slug);
  await input.hot.put(
    mineKey,
    JSON.stringify([...mineStripped, ...functionIds])
  );
  await projectHotDocsForSearch(input.hot, projectedDocs);

  return result;
};

export const acceptOpenApiGeneration = async (input: {
  sourceId: string;
  sources: SourceStorePort;
}): Promise<void> => {
  await input.sources.acceptOpenApiGeneration({ sourceId: input.sourceId });
};

export const rollbackOpenApiGeneration = async (input: {
  generation: number;
  sourceId: string;
  sources: SourceStorePort;
}): Promise<void> => {
  await input.sources.rollbackOpenApiGeneration({
    generation: input.generation,
    sourceId: input.sourceId,
  });
};
