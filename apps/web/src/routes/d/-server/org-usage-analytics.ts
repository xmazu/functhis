export interface ExecutionAnalyticsRow {
  duration_total?: number | string;
  executions?: number | string;
  function_slug?: string;
  status?: string;
}

export interface ExecutionAnalyticsPeriod {
  averageDurationMs: number;
  errors: number;
  executions: number;
  functions: {
    averageDurationMs: number;
    errors: number;
    executions: number;
    name: string;
  }[];
}

export const emptyExecutionAnalyticsPeriod = (): ExecutionAnalyticsPeriod => ({
  averageDurationMs: 0,
  errors: 0,
  executions: 0,
  functions: [],
});

export const escapeAnalyticsOrganizationId = (organizationId: string): string =>
  organizationId.replaceAll("'", "''");

export const buildExecutionAnalyticsSql = (
  organizationId: string,
  hours: number
): string => {
  const escapedOrganizationId = escapeAnalyticsOrganizationId(organizationId);
  return `
    SELECT
      blob2 AS function_slug,
      blob3 AS status,
      SUM(_sample_interval) AS executions,
      SUM(_sample_interval * double1) AS duration_total
    FROM functhis_executions
    WHERE index1 = '${escapedOrganizationId}'
      AND timestamp >= NOW() - INTERVAL '${hours}' HOUR
    GROUP BY function_slug, status
  `;
};

export const aggregateExecutionAnalyticsPeriod = (
  rows: ExecutionAnalyticsRow[]
): ExecutionAnalyticsPeriod => {
  const period = emptyExecutionAnalyticsPeriod();
  const byFunction = new Map<
    string,
    { duration: number; errors: number; executions: number }
  >();

  for (const row of rows) {
    const executions = Number(row.executions ?? 0);
    const duration = Number(row.duration_total ?? 0);
    const name = row.function_slug || 'Unknown function';
    const current = byFunction.get(name) ?? {
      duration: 0,
      errors: 0,
      executions: 0,
    };
    current.duration += duration;
    current.executions += executions;
    if (row.status !== 'ok') {
      current.errors += executions;
    }
    byFunction.set(name, current);
  }

  for (const [name, values] of byFunction) {
    period.executions += values.executions;
    period.errors += values.errors;
    period.functions.push({
      averageDurationMs:
        values.executions > 0 ? values.duration / values.executions : 0,
      errors: values.errors,
      executions: values.executions,
      name,
    });
  }

  period.averageDurationMs =
    period.executions > 0
      ? period.functions.reduce(
          (total, functionUsage) =>
            total + functionUsage.averageDurationMs * functionUsage.executions,
          0
        ) / period.executions
      : 0;
  period.functions.sort((left, right) => right.executions - left.executions);
  return period;
};
