/* eslint-disable complexity, no-await-in-loop -- OpenAPI import writes one generation then projects functions */
import type { Database } from '@functhis/db';
import {
  capabilityGeneration,
  capabilitySource,
  pkg,
  pkgFunction,
  packageVersion,
} from '@functhis/db/schema/catalog';
import { and, desc, eq } from 'drizzle-orm';

import { writeHotFunctionDoc } from '../catalog/hot-catalog';
import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { stripPackageFunctionIds } from '../catalog/hot-index';
import { mineIndexHotKey, orgIndexHotKey } from '../catalog/hot-keys';
import { projectHotDocsForSearch } from '../catalog/hot-search-projection';
import { resolvePackagePublicHandle } from '../catalog/package-public-handle';
import { WORKER_COMPATIBILITY_DATE } from '../constants';
import type { HotKvBinding } from '../http/http-context';
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

export const importOpenApiSource = async (input: {
  credentialName?: string;
  database: Database;
  hot: HotKvBinding;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  spec: unknown;
}): Promise<{
  drifted: boolean;
  generation: number;
  health: SourceHealth;
  packageId: string;
  sourceId: string;
}> => {
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

  const drifted = Boolean(existing && existing.schemaHash !== contractHash);
  const nextGeneration = (existing?.currentGeneration ?? 0) + 1;
  const health: SourceHealth = drifted ? 'degraded' : 'ready';

  let packageId = existing?.packageId;
  if (!packageId) {
    const [created] = await input.database
      .insert(pkg)
      .values({
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        slug: input.slug,
        sourceKind: 'openapi_operation',
        visibility: 'organization',
      })
      .returning({ id: pkg.id });
    packageId = created?.id;
    if (!packageId) {
      throw new Error('Failed to create OpenAPI package');
    }
  }

  const [version] = await input.database
    .insert(packageVersion)
    .values({
      artifactKey: `openapi:${input.slug}`,
      bundleHash: `openapi:${contractHash}`,
      contracts: operations,
      createdBy: input.ownerUserId,
      hostAllowlist: [new URL(endpoint).hostname],
      packageId,
      runtimeVersion: WORKER_COMPATIBILITY_DATE,
      secretNames: input.credentialName ? [input.credentialName] : [],
      semver: `0.0.${nextGeneration}`,
      sourceHash: contractHash.slice(0, 40),
    })
    .returning({ id: packageVersion.id });
  if (!version) {
    throw new Error('Failed to record OpenAPI generation');
  }

  if (!drifted) {
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
        currentGeneration: drifted
          ? existing?.currentGeneration
          : nextGeneration,
        endpoint,
        health,
        lastError: drifted ? 'schema_drift' : null,
        packageId,
        schemaHash: existing?.schemaHash ?? contractHash,
      })
      .where(eq(capabilitySource.id, sourceId));
  } else {
    const [createdSource] = await input.database
      .insert(capabilitySource)
      .values({
        credentialName: input.credentialName,
        currentGeneration: nextGeneration,
        endpoint,
        health: 'ready',
        kind: 'openapi',
        organizationId: input.organizationId,
        packageId,
        schemaHash: contractHash,
        slug: input.slug,
      })
      .returning({ id: capabilitySource.id });
    sourceId = createdSource?.id;
    if (!sourceId) {
      throw new Error('Failed to create capability source');
    }
  }

  await input.database.insert(capabilityGeneration).values({
    contractBundle: spec,
    contractHash,
    generation: nextGeneration,
    sourceId,
  });

  if (drifted) {
    return {
      drifted: true,
      generation: existing?.currentGeneration ?? 0,
      health,
      packageId,
      sourceId,
    };
  }

  await Promise.all(
    operations.map((operation) =>
      input.database
        .insert(pkgFunction)
        .values({
          contract: {
            description: operation.description,
            inputSchema: operation.requestSchema,
          },
          exportName: operation.operationId,
          packageId,
          path: operation.path,
          searchText: buildFunctionSearchText({
            contract: {
              description: operation.description,
              inputSchema: operation.requestSchema,
            },
            slug: operation.operationId,
          }),
          slug: operation.operationId,
        })
        .onConflictDoUpdate({
          set: {
            contract: {
              description: operation.description,
              inputSchema: operation.requestSchema,
            },
            exportName: operation.operationId,
            path: operation.path,
            updatedAt: new Date(),
          },
          target: [pkgFunction.packageId, pkgFunction.slug],
        })
    )
  );

  const functionIds: string[] = [];
  const projectedDocs: HotFunctionDoc[] = [];
  for (const operation of operations) {
    const [row] = await input.database
      .select({
        contract: pkgFunction.contract,
        functionId: pkgFunction.id,
        searchText: pkgFunction.searchText,
      })
      .from(pkgFunction)
      .where(
        and(
          eq(pkgFunction.packageId, packageId),
          eq(pkgFunction.slug, operation.operationId)
        )
      )
      .limit(1);
    if (!row) {
      continue;
    }
    const doc: HotFunctionDoc = {
      availability: 'ready',
      bundleHash: `openapi:${contractHash}`,
      contract: row.contract,
      functionId: row.functionId,
      functionSlug: operation.operationId,
      generation: nextGeneration,
      handle,
      hostAllowlist: [new URL(endpoint).hostname],
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      packageId,
      packageSlug: input.slug,
      searchText: row.searchText ?? operation.operationId,
      sourceCredentialName: input.credentialName,
      sourceEndpoint: endpoint,
      sourceKind: 'openapi_operation',
      sourceMethod: operation.method,
      sourcePath: operation.path,
      versionId: version.id,
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

  return {
    drifted: false,
    generation: nextGeneration,
    health: 'ready',
    packageId,
    sourceId,
  };
};

export const acceptOpenApiGeneration = async (input: {
  database: Database;
  sourceId: string;
}): Promise<void> => {
  const [source] = await input.database
    .select()
    .from(capabilitySource)
    .where(eq(capabilitySource.id, input.sourceId))
    .limit(1);
  if (!source) {
    throw new Error('Capability source not found');
  }
  const [latest] = await input.database
    .select()
    .from(capabilityGeneration)
    .where(eq(capabilityGeneration.sourceId, input.sourceId))
    .orderBy(desc(capabilityGeneration.generation))
    .limit(1);
  if (!latest) {
    return;
  }
  await input.database
    .update(capabilitySource)
    .set({
      currentGeneration: latest.generation,
      health: 'ready',
      lastError: null,
      schemaHash: latest.contractHash,
    })
    .where(eq(capabilitySource.id, input.sourceId));
};

export const rollbackOpenApiGeneration = async (input: {
  database: Database;
  generation: number;
  sourceId: string;
}): Promise<void> => {
  const [row] = await input.database
    .select()
    .from(capabilityGeneration)
    .where(
      and(
        eq(capabilityGeneration.sourceId, input.sourceId),
        eq(capabilityGeneration.generation, input.generation)
      )
    )
    .limit(1);
  if (!row) {
    throw new Error('Unknown generation');
  }
  await input.database
    .update(capabilitySource)
    .set({
      currentGeneration: input.generation,
      health: 'ready',
      lastError: null,
      schemaHash: row.contractHash,
    })
    .where(eq(capabilitySource.id, input.sourceId));
};
