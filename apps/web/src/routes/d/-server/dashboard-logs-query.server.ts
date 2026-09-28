import {
  filterDashboardTelemetryRecords,
  listAccessiblePackagesForUser,
  limitsForPlan,
  queryAxiomLogs,
  resolveOrgPlan,
} from '@functhis/publish';

import { env } from '#/env.server';
import { getDb } from '#/services';

const MAX_PAGE_SIZE = 100;

const parseDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export interface DashboardLogRow {
  executionId: string;
  functionSlug: string;
  handle: string;
  level: string;
  message: string;
  packageSlug: string;
  timestamp: string;
  versionId: string;
}

export interface DashboardLogsListResult {
  data: DashboardLogRow[];
  meta: {
    facets: Record<string, never>;
    filterRowCount: number;
    totalRowCount: number;
  };
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface DashboardLogsQueryInput {
  cursor?: string;
  endTime?: string;
  executionId?: string;
  level?: string;
  message?: string;
  packageSlug?: string;
  size?: number;
  sortDirection?: 'asc' | 'desc';
  startTime?: string;
}

const parseLevels = (value: string | undefined): string[] =>
  value
    ?.split(',')
    .map((level) => level.trim())
    .filter(Boolean) ?? [];

const serializeLogField = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

export const fetchDashboardLogs = async (
  _request: Request,
  userId: string,
  organizationId: string,
  input: DashboardLogsQueryInput
): Promise<
  | DashboardLogsListResult
  | {
      execution: {
        input: string | null;
        output: string | null;
        status: string | null;
      } | null;
    }
  | 'not_configured'
  | 'unavailable'
> => {
  const database = await getDb();
  const accessiblePackages = await listAccessiblePackagesForUser(
    database,
    userId
  );
  const packages = accessiblePackages.filter(
    (pkg) => pkg.organizationId === organizationId
  );
  const plan = await resolveOrgPlan(database, organizationId);
  const { logRetentionDays } = limitsForPlan(plan);
  if (logRetentionDays === 0 || packages.length === 0) {
    if (input.executionId) {
      return { execution: null };
    }
    return {
      data: [],
      meta: { filterRowCount: 0, facets: {}, totalRowCount: 0 },
      nextCursor: null,
      prevCursor: null,
    };
  }

  const requestedStart = parseDate(input.startTime);
  const retentionStart = new Date(Date.now() - logRetentionDays * 86_400_000);
  const startTime =
    requestedStart && requestedStart > retentionStart
      ? requestedStart
      : retentionStart;
  const limit = Math.min(Math.max(input.size ?? 50, 1), MAX_PAGE_SIZE);

  const axiomResult = await queryAxiomLogs(
    {
      AXIOM_API_TOKEN: env.AXIOM_API_TOKEN,
      AXIOM_DATASET: env.AXIOM_DATASET,
      AXIOM_EDGE: env.AXIOM_EDGE,
      AXIOM_EDGE_URL: env.AXIOM_EDGE_URL,
    },
    {
      cursor: input.cursor,
      endTime: parseDate(input.endTime),
      executionId: input.executionId,
      level: parseLevels(input.level),
      limit,
      message: input.message,
      organizationId,
      packageSlug: input.packageSlug,
      sortDirection: input.sortDirection,
      startTime,
    }
  );

  if (axiomResult.kind === 'not_configured') {
    return 'not_configured';
  }
  if (axiomResult.kind === 'query_failed') {
    return 'unavailable';
  }
  const records = filterDashboardTelemetryRecords(axiomResult.records, {
    executionId: input.executionId,
    organizationId,
    packages,
  });

  if (input.executionId) {
    return {
      execution: records[0]
        ? {
            input: serializeLogField(records[0].input),
            output: serializeLogField(records[0].output),
            status:
              records[0].status === null || records[0].status === undefined
                ? null
                : String(records[0].status),
          }
        : null,
    };
  }

  const data: DashboardLogRow[] = records.map((record) => ({
    executionId: String(record.executionId ?? record.ft_execution_id ?? ''),
    functionSlug: String(record.functionSlug ?? record.ft_function_slug ?? ''),
    handle: String(record.handle ?? record.ft_handle ?? ''),
    level: String(record.level ?? 'log'),
    message: String(record.message ?? ''),
    packageSlug: String(record.packageSlug ?? record.ft_package_slug ?? ''),
    timestamp: String(record.timestamp ?? record._time ?? ''),
    versionId: String(record.versionId ?? record.ft_version_id ?? ''),
  }));
  const lastAxiom = axiomResult.records.at(-1);
  const lastTimestamp = lastAxiom
    ? String(lastAxiom.timestamp ?? lastAxiom._time ?? '')
    : '';
  const first = data[0]?.timestamp ?? null;
  const fetchedFullPage = axiomResult.records.length === limit;

  return {
    data,
    meta: {
      filterRowCount: data.length,
      facets: {},
      totalRowCount: data.length,
    },
    nextCursor:
      fetchedFullPage && lastTimestamp.length > 0 ? lastTimestamp : null,
    prevCursor: first,
  };
};
