import { sha256Hex } from '@functhis/core/publish/bundle';
import { WORKER_COMPATIBILITY_DATE } from '@functhis/core/publish/constants';
import type { RemoteMcpTool } from '@functhis/core/publish/remote-mcp-protocol';
import { buildFunctionSearchText } from '@functhis/core/publish/search/function-search-text';

import { and, eq } from '../drizzle';
import type { Database } from '../index';
import {
  capabilityGeneration,
  capabilitySource,
  pkg,
  pkgFunction,
  packageVersion,
} from '../schema/catalog';
import { resolveOrganizationSlugById } from './memberships';

export interface PersistRemoteMcpSyncInput {
  credentialName?: string;
  endpoint: string;
  health?: 'degraded' | 'failed' | 'ready';
  lastError?: string | null;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  tools: RemoteMcpTool[];
}

export interface PersistRemoteMcpSyncResult {
  health: 'degraded' | 'failed' | 'ready';
  packageId: string;
  sourceId: string;
}

/* eslint-disable complexity -- Remote MCP sync mirrors core SQL path */
export const persistRemoteMcpSync = async (
  database: Database,
  input: PersistRemoteMcpSyncInput
): Promise<PersistRemoteMcpSyncResult> => {
  const handle = await resolveOrganizationSlugById(
    database,
    input.organizationId
  );
  if (!handle) {
    throw new Error('Organization handle is missing');
  }

  const [existing] = await database
    .select()
    .from(capabilitySource)
    .where(
      and(
        eq(capabilitySource.organizationId, input.organizationId),
        eq(capabilitySource.slug, input.slug)
      )
    )
    .limit(1);

  const { tools } = input;
  let health = input.health ?? 'ready';
  let lastError = input.lastError ?? null;

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
    const [created] = await database
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
  const [version] = await database
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
    await database
      .update(pkg)
      .set({ currentVersionId: version.id })
      .where(eq(pkg.id, packageId));
  }

  let sourceId = existing?.id;
  if (sourceId) {
    await database
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
    const [createdSource] = await database
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

  await database.insert(capabilityGeneration).values({
    contractBundle: { tools },
    contractHash: schemaHash,
    generation,
    sourceId,
  });

  if (health !== 'ready') {
    return { health, packageId, sourceId };
  }

  await Promise.all(
    tools.map((tool) =>
      database
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
        })
    )
  );

  return { health: 'ready', packageId, sourceId };
};
