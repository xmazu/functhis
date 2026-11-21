/* eslint-disable no-await-in-loop -- sequential HOT doc writes per tool */
import { sha256Hex } from '../bundle';
import { writeHotFunctionDoc } from '../catalog/hot-catalog';
import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { stripPackageFunctionIds } from '../catalog/hot-index';
import {
  mcpSnapshotHotKey,
  mineIndexHotKey,
  orgIndexHotKey,
} from '../catalog/hot-keys';
import { projectHotDocsForSearch } from '../catalog/hot-search-projection';
import type { HotKvBinding } from '../http/http-context';
import type {
  HotCatalogSourcePort,
  SourceSyncMembershipsPort,
  SourceStorePort,
} from '../ports';
import { buildFunctionSearchText } from '../search/function-search-text';
import {
  buildRemoteMcpListToolsRequest,
  parseRemoteMcpTools,
  remoteMcpCacheFresh,
} from './remote-mcp-protocol';
import type { RemoteMcpSnapshot, RemoteMcpTool } from './remote-mcp-protocol';

const readSnapshot = async (
  hot: HotKvBinding,
  sourceId: string
): Promise<RemoteMcpSnapshot | null> => {
  const raw = await hot.get(mcpSnapshotHotKey(sourceId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RemoteMcpSnapshot;
  } catch {
    return null;
  }
};

export const peekRemoteMcpSnapshot = async (
  hot: HotKvBinding,
  sourceId: string,
  nowMs = Date.now()
): Promise<RemoteMcpSnapshot | null> => {
  const snapshot = await readSnapshot(hot, sourceId);
  if (!remoteMcpCacheFresh(snapshot, nowMs)) {
    return snapshot;
  }
  return snapshot;
};

export const invalidateRemoteMcpSnapshot = async (
  hot: HotKvBinding,
  sourceId: string
): Promise<void> => {
  await hot.delete(mcpSnapshotHotKey(sourceId));
};

export const fetchRemoteMcpTools = async (
  endpoint: string,
  headers: Record<string, string> = {}
): Promise<RemoteMcpTool[]> => {
  const response = await fetch(endpoint, {
    body: JSON.stringify(buildRemoteMcpListToolsRequest()),
    headers: {
      Accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Remote MCP list_tools failed (${response.status})`);
  }
  return parseRemoteMcpTools(await response.json());
};

const writeSnapshot = async (
  hot: HotKvBinding,
  sourceId: string,
  snapshot: RemoteMcpSnapshot
): Promise<void> => {
  await hot.put(mcpSnapshotHotKey(sourceId), JSON.stringify(snapshot));
};

interface SyncRemoteMcpPersistResult {
  health: 'degraded' | 'failed' | 'ready';
  packageId: string;
  sourceId: string;
}

export const syncRemoteMcpSource = async (input: {
  credentialName?: string;
  endpoint: string;
  headers?: Record<string, string>;
  hot: HotKvBinding;
  hotSource: HotCatalogSourcePort;
  memberships: SourceSyncMembershipsPort;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  sources: SourceStorePort;
  tools?: RemoteMcpTool[];
}): Promise<SyncRemoteMcpPersistResult> => {
  let { tools } = input;
  let health: 'degraded' | 'failed' | 'ready' = 'ready';
  let lastError: string | null = null;
  if (!tools) {
    try {
      tools = await fetchRemoteMcpTools(input.endpoint, input.headers ?? {});
    } catch (error) {
      health = 'failed';
      lastError = error instanceof Error ? error.message : String(error);
      tools = [];
    }
  }

  const result = (await input.sources.syncRemoteMcpSource({
    credentialName: input.credentialName,
    endpoint: input.endpoint,
    health,
    lastError,
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    slug: input.slug,
    tools,
  })) as SyncRemoteMcpPersistResult;

  await writeSnapshot(input.hot, result.sourceId, {
    fetchedAtMs: Date.now(),
    health: health === 'failed' ? 'failed' : result.health,
    tools,
  });

  if (health !== 'ready') {
    return result;
  }

  const handle = await input.memberships.resolveOrganizationSlugById(
    input.organizationId
  );
  if (!handle) {
    throw new Error('Organization handle is missing');
  }

  const schemaHash = await sha256Hex(JSON.stringify(tools));
  const projection = await input.hotSource.loadPackageProjection(
    result.packageId
  );
  const fnBySlug = new Map(
    (projection?.functions ?? []).map((fn) => [fn.functionSlug, fn])
  );

  const functionIds: string[] = [];
  const projectedDocs: HotFunctionDoc[] = [];
  for (const tool of tools) {
    const row = fnBySlug.get(tool.name);
    if (!row) {
      continue;
    }
    const siblings = tools
      .filter((candidate) => candidate.name !== tool.name)
      .slice(0, 8)
      .map((candidate) => candidate.name);
    const doc: HotFunctionDoc = {
      availability: 'ready',
      bundleHash: `mcp:${schemaHash}`,
      contract: {
        description: tool.description,
        inputSchema: tool.inputSchema,
        related: siblings,
      },
      functionId: row.functionId,
      functionSlug: tool.name,
      handle,
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      packageId: result.packageId,
      packageSlug: input.slug,
      searchText:
        buildFunctionSearchText({
          contract: {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          slug: tool.name,
        }) || tool.name,
      sourceCredentialName: input.credentialName,
      sourceEndpoint: input.endpoint,
      sourceKind: 'remote_mcp_tool',
      versionId: row.versionId,
      visibility: 'organization',
    };
    await writeHotFunctionDoc(input.hot, doc);
    projectedDocs.push(doc);
    functionIds.push(`@${handle}/${input.slug}/${tool.name}`);
  }

  const orgKey = orgIndexHotKey(input.organizationId);
  const orgRaw = await input.hot.get(orgKey);
  const orgIds = orgRaw ? (JSON.parse(orgRaw) as string[]) : [];
  await input.hot.put(
    orgKey,
    JSON.stringify([
      ...stripPackageFunctionIds(orgIds, [handle], input.slug),
      ...functionIds,
    ])
  );
  const mineKey = mineIndexHotKey(input.ownerUserId);
  const mineRaw = await input.hot.get(mineKey);
  const mineIds = mineRaw ? (JSON.parse(mineRaw) as string[]) : [];
  await input.hot.put(
    mineKey,
    JSON.stringify([
      ...stripPackageFunctionIds(mineIds, [handle], input.slug),
      ...functionIds,
    ])
  );
  await projectHotDocsForSearch(input.hot, projectedDocs);

  return {
    health: 'ready',
    packageId: result.packageId,
    sourceId: result.sourceId,
  };
};
