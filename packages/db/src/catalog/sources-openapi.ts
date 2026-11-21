import { WORKER_COMPATIBILITY_DATE } from '@functhis/core/publish/constants';
import {
  extractOpenApiOperations,
  hashOpenApiSpec,
  openApiServerUrl,
} from '@functhis/core/publish/openapi-operations';
import type { OpenApiOperation } from '@functhis/core/publish/openapi-operations';
import { buildFunctionSearchText } from '@functhis/core/publish/search/function-search-text';

import { and, desc, eq } from '../drizzle';
import type { Database } from '../index';
import {
  capabilityGeneration,
  capabilitySource,
  pkg,
  pkgFunction,
  packageVersion,
} from '../schema/catalog';
import { resolveOrganizationSlugById } from './memberships';

export type SourceHealth = 'degraded' | 'ready' | 'unavailable';

export interface PersistImportOpenApiInput {
  credentialName?: string;
  organizationId: string;
  ownerUserId: string;
  slug: string;
  spec: Record<string, unknown>;
}

export interface PersistImportOpenApiResult {
  drifted: boolean;
  generation: number;
  health: SourceHealth;
  packageId: string;
  sourceId: string;
}

export interface AcceptOpenApiGenerationInput {
  sourceId: string;
}

export interface RollbackOpenApiGenerationInput {
  generation: number;
  sourceId: string;
}

const asSpec = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

/* eslint-disable complexity -- OpenAPI import mirrors core SQL path */
export const persistImportOpenApi = async (
  database: Database,
  input: PersistImportOpenApiInput
): Promise<PersistImportOpenApiResult> => {
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

  const drifted = Boolean(existing && existing.schemaHash !== contractHash);
  const nextGeneration = (existing?.currentGeneration ?? 0) + 1;
  const health: SourceHealth = drifted ? 'degraded' : 'ready';

  let packageId = existing?.packageId;
  if (!packageId) {
    const [created] = await database
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

  const [version] = await database
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
    const [createdSource] = await database
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

  await database.insert(capabilityGeneration).values({
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
    operations.map((operation: OpenApiOperation) =>
      database
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

  return {
    drifted: false,
    generation: nextGeneration,
    health: 'ready',
    packageId,
    sourceId,
  };
};

export const acceptOpenApiGeneration = async (
  database: Database,
  input: AcceptOpenApiGenerationInput
): Promise<void> => {
  const [source] = await database
    .select()
    .from(capabilitySource)
    .where(eq(capabilitySource.id, input.sourceId))
    .limit(1);
  if (!source) {
    throw new Error('Capability source not found');
  }
  const [latest] = await database
    .select()
    .from(capabilityGeneration)
    .where(eq(capabilityGeneration.sourceId, input.sourceId))
    .orderBy(desc(capabilityGeneration.generation))
    .limit(1);
  if (!latest) {
    return;
  }
  await database
    .update(capabilitySource)
    .set({
      currentGeneration: latest.generation,
      health: 'ready',
      lastError: null,
      schemaHash: latest.contractHash,
    })
    .where(eq(capabilitySource.id, input.sourceId));
};

export const rollbackOpenApiGeneration = async (
  database: Database,
  input: RollbackOpenApiGenerationInput
): Promise<void> => {
  const [row] = await database
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
  await database
    .update(capabilitySource)
    .set({
      currentGeneration: input.generation,
      health: 'ready',
      lastError: null,
      schemaHash: row.contractHash,
    })
    .where(eq(capabilitySource.id, input.sourceId));
};
