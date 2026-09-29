import {
  execution,
  pkg,
  pkgFunction,
  packageVersion,
} from '@functhis/db/schema/catalog';
import {
  buildPackageAccessContext,
  canAccessPackage,
  getPackageBySlugs,
  limitsForPlan,
  listPackageExecutions,
  queryAxiom,
  readAxiomQueryRecords,
  resolveOrgPlan,
} from '@functhis/publish';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';
import { getDb } from '#/services';

import {
  executionPayloadFromAxiomRecords,
  unavailableExecutionPayload,
} from './execution-payload';
import type {
  ExecutionPayloadState,
  SerializableValue,
} from './execution-payload';

const packageInput = z.object({
  handle: z.string().min(1).max(128),
  packageSlug: z.string().min(1).max(128),
});

const executionInput = packageInput.extend({
  executionId: z.string().min(1).max(128),
});

export interface ExecutionListItem {
  createdAt: Date;
  functionSlug: string | null;
  id: string;
  status: string;
}

export interface ExecutionListViewModel {
  available: boolean;
  executions: ExecutionListItem[];
  handle: string;
  packageSlug: string;
}

export interface ExecutionDetailViewModel {
  createdAt: Date;
  cpuMs: number | null;
  functionSlug: string | null;
  handle: string;
  id: string;
  packageSlug: string;
  payload: {
    input: SerializableValue;
    logs: { level: string; message: string; timestamp: string }[];
    output: SerializableValue;
  } | null;
  payloadState: ExecutionPayloadState;
  requestBytes: number | null;
  responseBytes: number | null;
  startedAt: Date | null;
  status: string;
}

const getAuthorizedPackage = async (
  userId: string,
  handle: string,
  packageSlug: string
) => {
  const database = await getDb();
  const catalog = await getPackageBySlugs(database, handle, packageSlug);
  if (!catalog) {
    return null;
  }
  const access = await buildPackageAccessContext(database, userId);
  if (!canAccessPackage(catalog, access)) {
    return null;
  }
  return { catalog, database };
};

const axiomConfigured = (): boolean =>
  Boolean(env.AXIOM_API_TOKEN && env.AXIOM_DATASET);

const retentionCutoffForPlan = (logRetentionDays: number): Date | undefined => {
  if (logRetentionDays === 0) {
    return undefined;
  }
  return new Date(Date.now() - logRetentionDays * 86_400_000);
};

const loadExecutionPayload = async (
  executionId: string,
  organizationId: string,
  row: { createdAt: Date; startedAt: Date | null }
): Promise<{
  payload: ExecutionDetailViewModel['payload'];
  payloadState: ExecutionPayloadState;
}> => {
  const database = await getDb();
  const plan = await resolveOrgPlan(database, organizationId);
  const { logRetentionDays } = limitsForPlan(plan);
  if (logRetentionDays === 0) {
    return { payload: null, payloadState: 'expired' };
  }

  if (!axiomConfigured()) {
    return unavailableExecutionPayload();
  }

  const result = await queryAxiom(
    {
      AXIOM_API_TOKEN: env.AXIOM_API_TOKEN,
      AXIOM_DATASET: env.AXIOM_DATASET,
      AXIOM_EDGE: env.AXIOM_EDGE,
      AXIOM_EDGE_URL: env.AXIOM_EDGE_URL,
    },
    `search ${JSON.stringify(executionId)} | search ${JSON.stringify(organizationId)} | sort by _time asc`,
    logRetentionDays
  );
  if (result === null) {
    return unavailableExecutionPayload();
  }

  const records = readAxiomQueryRecords(result);
  return executionPayloadFromAxiomRecords(records, {
    createdAt: row.createdAt,
    logRetentionDays,
    startedAt: row.startedAt,
  });
};

const selectExecutionDetailFields = {
  createdAt: execution.createdAt,
  cpuMs: execution.cpuMs,
  functionSlug: pkgFunction.slug,
  id: execution.id,
  requestBytes: execution.requestBytes,
  responseBytes: execution.responseBytes,
  startedAt: execution.startedAt,
  status: execution.status,
};

export const listExecutionsForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(packageInput)
  .handler(
    async ({ context, data }): Promise<ExecutionListViewModel | null> => {
      const userId = context.session?.user.id;
      if (!userId) {
        return null;
      }
      const authorized = await getAuthorizedPackage(
        userId,
        data.handle,
        data.packageSlug
      );
      if (!authorized) {
        return null;
      }

      const plan = await resolveOrgPlan(
        authorized.database,
        authorized.catalog.organizationId
      );
      const { logRetentionDays } = limitsForPlan(plan);
      const rows = await listPackageExecutions(
        authorized.database,
        authorized.catalog.id,
        {
          limit: 100,
          retentionCutoff: retentionCutoffForPlan(logRetentionDays),
        }
      );

      return {
        available: true,
        executions: rows.map((row) => ({
          createdAt: row.createdAt,
          functionSlug: row.functionSlug,
          id: row.id,
          status: row.status,
        })),
        handle: authorized.catalog.handle,
        packageSlug: authorized.catalog.packageSlug,
      };
    }
  );

export const getExecutionForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(executionInput)
  .handler(
    async ({ context, data }): Promise<ExecutionDetailViewModel | null> => {
      const userId = context.session?.user.id;
      if (!userId) {
        return null;
      }
      const authorized = await getAuthorizedPackage(
        userId,
        data.handle,
        data.packageSlug
      );
      if (!authorized) {
        return null;
      }

      const plan = await resolveOrgPlan(
        authorized.database,
        authorized.catalog.organizationId
      );
      const { logRetentionDays } = limitsForPlan(plan);
      const retentionCutoff = retentionCutoffForPlan(logRetentionDays);

      const baseConditions = [
        eq(pkg.id, authorized.catalog.id),
        eq(execution.id, data.executionId),
      ];

      const [row] = await authorized.database
        .select(selectExecutionDetailFields)
        .from(execution)
        .innerJoin(
          packageVersion,
          eq(execution.packageVersionId, packageVersion.id)
        )
        .innerJoin(pkg, eq(packageVersion.packageId, pkg.id))
        .leftJoin(pkgFunction, eq(execution.functionId, pkgFunction.id))
        .where(and(...baseConditions))
        .limit(1);

      if (!row) {
        return null;
      }

      if (logRetentionDays === 0) {
        return {
          ...row,
          handle: authorized.catalog.handle,
          packageSlug: authorized.catalog.packageSlug,
          payload: null,
          payloadState: 'expired',
        };
      }

      if (retentionCutoff) {
        const referenceTime = row.startedAt ?? row.createdAt;
        if (referenceTime < retentionCutoff) {
          return null;
        }
      }

      const { payload, payloadState } = await loadExecutionPayload(
        row.id,
        authorized.catalog.organizationId,
        row
      );
      return {
        ...row,
        handle: authorized.catalog.handle,
        packageSlug: authorized.catalog.packageSlug,
        payload,
        payloadState,
      };
    }
  );
