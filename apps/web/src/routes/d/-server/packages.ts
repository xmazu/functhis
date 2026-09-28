import type { Database } from '@functhis/db';
import {
  capabilitySource,
  execution,
  packageVersion,
} from '@functhis/db/schema/catalog';
import {
  buildPackageAccessContext,
  canAccessPackage,
  canWritePackageSecrets,
  getPackageBySlugs,
  listAccessiblePackagesForUser,
  listOrganizationSecrets,
  listPackageSecrets,
  limitsForPlan,
  listPackageExecutions,
  resolveOrgPlan,
  resolveOrganizationSlugById,
} from '@functhis/publish';
import { formatFunctionId } from '@functhis/publish/function-id';
import { loadGraphEdgesForSeeds } from '@functhis/publish/graph-hot';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { createServerFn } from '@tanstack/react-start';
import { eq, inArray, sql } from 'drizzle-orm';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';
import { withCallCounts } from '#/routes/d/-lib/package-list';
import { getDb } from '#/services';

import { buildPackageDetailViewModel } from './package-detail-view-model';

const retentionCutoffForPlan = (logRetentionDays: number): Date | undefined => {
  if (logRetentionDays === 0) {
    return undefined;
  }
  return new Date(Date.now() - logRetentionDays * 86_400_000);
};

const countCallsByPackageIds = async (
  database: Database,
  packageIds: string[]
): Promise<Map<string, number>> => {
  if (packageIds.length === 0) {
    return new Map();
  }

  const rows = await database
    .select({
      callCount: sql<number>`count(${execution.id})`.mapWith(Number),
      packageId: packageVersion.packageId,
    })
    .from(execution)
    .innerJoin(
      packageVersion,
      eq(execution.packageVersionId, packageVersion.id)
    )
    .where(inArray(packageVersion.packageId, packageIds))
    .groupBy(packageVersion.packageId);

  return new Map(rows.map((row) => [row.packageId, row.callCount]));
};

export const listPackagesForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user.id;
    if (!userId) {
      return [];
    }
    const database = await getDb();
    const packages = await listAccessiblePackagesForUser(database, userId);
    const callCounts = await countCallsByPackageIds(
      database,
      packages.map((pkg) => pkg.id)
    );
    const sourceRows =
      packages.length === 0
        ? []
        : await database
            .select({
              health: capabilitySource.health,
              packageId: capabilitySource.packageId,
            })
            .from(capabilitySource)
            .where(
              inArray(
                capabilitySource.packageId,
                packages.map((pkg) => pkg.id)
              )
            );
    const healthByPackage = new Map(
      sourceRows.flatMap((row) =>
        row.packageId ? [[row.packageId, row.health]] : []
      )
    );
    return withCallCounts(packages, callCounts).map((pkg) => ({
      ...pkg,
      health: healthByPackage.get(pkg.id) ?? 'ready',
      sourceKind: pkg.sourceKind,
    }));
  });

export const getPackageDetailForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator((input: { handle: string; slug: string }) => input)
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      return null;
    }

    const database = await getDb();
    const catalog = await getPackageBySlugs(database, data.handle, data.slug);
    if (!catalog) {
      return null;
    }

    const accessContext = await buildPackageAccessContext(database, userId);
    if (!canAccessPackage(catalog, accessContext)) {
      return null;
    }

    const organizationSlug = await resolveOrganizationSlugById(
      database,
      catalog.organizationId
    );

    const isOwner = catalog.ownerUserId === userId;
    const plan = await resolveOrgPlan(database, catalog.organizationId);
    const { logRetentionDays } = limitsForPlan(plan);
    const retentionCutoff = retentionCutoffForPlan(logRetentionDays);
    const [executions, packageSecrets, orgSecrets, canWriteSecrets] =
      await Promise.all([
        listPackageExecutions(database, catalog.id, {
          limit: 20,
          retentionCutoff,
        }),
        listPackageSecrets(database, userId, catalog),
        listOrganizationSecrets(database, userId, catalog.organizationId),
        canWritePackageSecrets(database, userId, catalog),
      ]);

    const setNames = new Set([
      ...(packageSecrets?.secrets.map((row) => row.name) ?? []),
      ...(orgSecrets?.secrets.map((row) => row.name) ?? []),
    ]);
    const missingSecretNames = catalog.currentVersion.secretNames.filter(
      (name) => !setNames.has(name)
    );

    const [source] = await database
      .select()
      .from(capabilitySource)
      .where(eq(capabilitySource.packageId, catalog.id))
      .limit(1);
    const functionIds = catalog.functions.map((fn) =>
      formatFunctionId({
        functionSlug: fn.functionSlug,
        handle: fn.handle,
        packageSlug: fn.packageSlug,
      })
    );
    const functionEdges = await loadGraphEdgesForSeeds(
      asHotKvBinding(env.HOT),
      functionIds
    );

    return buildPackageDetailViewModel({
      canWriteSecrets,
      catalog,
      executions,
      functionEdges,
      isOwner,
      mcpResource: env.MCP_RESOURCE,
      missingSecretNames,
      organizationSlug,
      secrets: packageSecrets?.secrets ?? [],
      sourceHealth: source
        ? {
            currentGeneration: source.currentGeneration,
            health: source.health,
            lastError: source.lastError,
            sourceId: source.id,
          }
        : null,
    });
  });
