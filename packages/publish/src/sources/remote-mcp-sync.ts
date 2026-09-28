/* eslint-disable complexity, no-await-in-loop, no-nested-ternary -- remote MCP snapshot sync writes tools then projects functions */
import type { Database } from '@functhis/db';
import {
  capabilityGeneration,
  capabilitySource,
  pkg,
  pkgFunction,
  packageVersion,
} from '@functhis/db/schema/catalog';
import { and, eq } from 'drizzle-orm';

import { sha256Hex } from '../bundle';
import { writeHotFunctionDoc } from '../catalog/hot-catalog';
import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { stripPackageFunctionIds } from '../catalog/hot-index';
import {
  mcpSnapshotHotKey,
  mineIndexHotKey,
  orgIndexHotKey,
} from '../catalog/hot-keys';
import { resolvePackagePublicHandle } from '../catalog/package-public-handle';
import { WORKER_COMPATIBILITY_DATE } from '../constants';
import { projectCapabilityAfterHotWrite } from '../federation/catalog-projection';
import type { HotKvBinding } from '../http/http-context';
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

const writeSnapshot = async (
  hot: HotKvBinding,
  sourceId: string,
  snapshot: RemoteMcpSnapshot
): Promise<void> => {
  await hot.put(mcpSnapshotHotKey(sourceId), JSON.stringify(snapshot));
};

export const invalidateRemoteMcpSnapshot = async (
  hot: HotKvBinding,
  sourceId: string
): Promise<void> => {
  await hot.delete(mcpSnapshotHotKey(sourceId));
};

export const fetchRemoteMcpTools = async (
  endpoint: string,
  headers: Record<string, string>
): Promise<RemoteMcpTool[]> => {
  const response = await fetch(endpoint, {
    body: JSON.stringify(buildRemoteMcpListToolsRequest()),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Remote MCP list failed (${String(response.status)})`);
  }
  return parseRemoteMcpTools(await response.json());
};

export const syncRemoteMcpSource = async (input: {
  credentialName?: string;
  database: Database;
  endpoint: string;
  headers?: Record<string, string>;
  hot: HotKvBinding;
  organizationId: string;
  ownerUserId: string;
  peek?: boolean;
  slug: string;
  tools?: RemoteMcpTool[];
}): Promise<{
  health: 'degraded' | 'failed' | 'ready';
  packageId: string;
  sourceId: string;
}> => {
  const handle = await resolvePackagePublicHandle(
    input.database,
    input.organizationId
  );
  if (!handle) {
    throw new Error('Organization handle is missing');
  }

  const [existing] = await input.database
    .select()
    .from(capabilitySource)
    .where(
      and(
        eq(capabilitySource.organizationId, input.organizationId),
        eq(capabilitySource.slug, input.slug)
      )
    )
    .limit(1);

  if (input.peek && existing) {
    const snapshot = await peekRemoteMcpSnapshot(input.hot, existing.id);
    if (snapshot && remoteMcpCacheFresh(snapshot, Date.now())) {
      return {
        health: snapshot.health === 'ready' ? 'ready' : 'degraded',
        packageId: existing.packageId ?? '',
        sourceId: existing.id,
      };
    }
  }

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

  const schemaHash = await sha256Hex(JSON.stringify(tools));
  const drifted = Boolean(
    existing?.schemaHash && existing.schemaHash !== schemaHash
  );
  if (drifted && health === 'ready') {
    health = 'degraded';
    lastError = 'schema_drift';
  }

  let packageId = existing?.packageId;
  if (!packageId) {
    const [created] = await input.database
      .insert(pkg)
      .values({
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        slug: input.slug,
        sourceKind: 'remote_mcp_tool',
        visibility: 'organization',
      })
      .returning({ id: pkg.id });
    packageId = created?.id;
    if (!packageId) {
      throw new Error('Failed to create remote MCP package');
    }
  }

  const generation = (existing?.currentGeneration ?? 0) + 1;
  const [version] = await input.database
    .insert(packageVersion)
    .values({
      artifactKey: `mcp:${input.slug}`,
      bundleHash: `mcp:${schemaHash}`,
      contracts: tools,
      createdBy: input.ownerUserId,
      packageId,
      runtimeVersion: WORKER_COMPATIBILITY_DATE,
      secretNames: input.credentialName ? [input.credentialName] : [],
      semver: `0.0.${generation}`,
      sourceHash: schemaHash.slice(0, 40),
    })
    .returning({ id: packageVersion.id });
  if (!version) {
    throw new Error('Failed to record MCP generation');
  }
  if (health === 'ready') {
    await input.database
      .update(pkg)
      .set({ currentVersionId: version.id })
      .where(eq(pkg.id, packageId));
  }

  let sourceId = existing?.id;
  if (sourceId) {
    await input.database
      .update(capabilitySource)
      .set({
        credentialName: input.credentialName ?? existing?.credentialName,
        currentGeneration:
          health === 'ready' ? generation : existing?.currentGeneration,
        endpoint: input.endpoint,
        health,
        lastError,
        packageId,
        schemaHash: health === 'ready' ? schemaHash : existing?.schemaHash,
      })
      .where(eq(capabilitySource.id, sourceId));
  } else {
    const [createdSource] = await input.database
      .insert(capabilitySource)
      .values({
        credentialName: input.credentialName,
        currentGeneration: generation,
        endpoint: input.endpoint,
        health,
        kind: 'mcp',
        lastError,
        organizationId: input.organizationId,
        packageId,
        schemaHash,
        slug: input.slug,
      })
      .returning({ id: capabilitySource.id });
    sourceId = createdSource?.id;
    if (!sourceId) {
      throw new Error('Failed to create MCP source');
    }
  }

  await input.database.insert(capabilityGeneration).values({
    contractBundle: { tools },
    contractHash: schemaHash,
    generation,
    sourceId,
  });

  await writeSnapshot(input.hot, sourceId, {
    fetchedAtMs: Date.now(),
    health:
      health === 'failed'
        ? 'failed'
        : health === 'degraded'
          ? 'degraded'
          : 'ready',
    tools,
  });

  if (health !== 'ready') {
    return { health, packageId, sourceId };
  }

  const functionIds: string[] = [];
  for (const tool of tools) {
    await input.database
      .insert(pkgFunction)
      .values({
        contract: {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        exportName: tool.name,
        packageId,
        path: tool.name,
        searchText: buildFunctionSearchText({
          contract: {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          slug: tool.name,
        }),
        slug: tool.name,
      })
      .onConflictDoUpdate({
        set: {
          contract: {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          exportName: tool.name,
          path: tool.name,
          updatedAt: new Date(),
        },
        target: [pkgFunction.packageId, pkgFunction.slug],
      });
    const [row] = await input.database
      .select({
        functionId: pkgFunction.id,
        searchText: pkgFunction.searchText,
      })
      .from(pkgFunction)
      .where(
        and(
          eq(pkgFunction.packageId, packageId),
          eq(pkgFunction.slug, tool.name)
        )
      )
      .limit(1);
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
      generation,
      handle,
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      packageId,
      packageSlug: input.slug,
      searchText: row.searchText ?? tool.name,
      sourceCredentialName: input.credentialName,
      sourceEndpoint: input.endpoint,
      sourceKind: 'remote_mcp_tool',
      versionId: version.id,
      visibility: 'organization',
    };
    await writeHotFunctionDoc(input.hot, doc);
    await projectCapabilityAfterHotWrite({ doc, hot: input.hot });
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

  return { health: 'ready', packageId, sourceId };
};
