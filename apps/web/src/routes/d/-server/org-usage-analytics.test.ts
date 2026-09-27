import { describe, expect, test } from 'bun:test';

import {
  aggregateExecutionAnalyticsPeriod,
  buildExecutionAnalyticsSql,
  escapeAnalyticsOrganizationId,
} from '#/routes/d/-server/org-usage-analytics';

describe('escapeAnalyticsOrganizationId', () => {
  test('escapes single quotes for SQL literals', () => {
    expect(escapeAnalyticsOrganizationId("org'1")).toBe("org''1");
  });
});

describe('buildExecutionAnalyticsSql', () => {
  test('filters by organization index and hour window', () => {
    const sql = buildExecutionAnalyticsSql('org_abc', 24);
    expect(sql).toContain("index1 = 'org_abc'");
    expect(sql).toContain("INTERVAL '24' HOUR");
  });
});

describe('aggregateExecutionAnalyticsPeriod', () => {
  test('sums executions and errors per function', () => {
    const period = aggregateExecutionAnalyticsPeriod([
      {
        duration_total: 100,
        executions: 2,
        function_slug: 'hello',
        status: 'ok',
      },
      {
        duration_total: 50,
        executions: 1,
        function_slug: 'hello',
        status: 'error',
      },
    ]);
    expect(period.executions).toBe(3);
    expect(period.errors).toBe(1);
    expect(period.functions).toHaveLength(1);
    expect(period.functions[0]?.name).toBe('hello');
    expect(period.functions[0]?.executions).toBe(3);
  });

  test('returns empty period for no rows', () => {
    const period = aggregateExecutionAnalyticsPeriod([]);
    expect(period.executions).toBe(0);
    expect(period.functions).toEqual([]);
  });
});
