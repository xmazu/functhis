import { describe, expect, test } from 'bun:test';

import {
  aplJsonFieldSearch,
  aplJsonFieldSearchAny,
  aplSearch,
  filterDashboardTelemetryRecords,
  filterTelemetryRecordsByPackages,
  isTelemetryExecutionRecord,
  isTelemetryLogRecord,
  withTelemetryIndexFields,
} from './axiom-apl';
import { buildAxiomLogQuery, queryAxiomLogs } from './axiom-logs';

const axiomBindings = {
  AXIOM_API_TOKEN: 'token',
  AXIOM_DATASET: 'functhis_executions',
  AXIOM_EDGE: 'eu-central-1.aws.edge.axiom.co',
};

describe('queryAxiomLogs', () => {
  test('returns not_configured when axiom is unset', async () => {
    expect(await queryAxiomLogs({}, { organizationId: 'org-1' })).toEqual({
      kind: 'not_configured',
    });
  });

  test('returns ok records when axiom responds', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        Response.json({
          matches: [{ executionId: 'exec-1', message: 'hello' }],
        })
      );

    try {
      expect(
        await queryAxiomLogs(axiomBindings, { organizationId: 'org-1' })
      ).toEqual({
        kind: 'ok',
        records: [{ executionId: 'exec-1', message: 'hello' }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('returns query_failed when axiom responds with an error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response('nope', { status: 500 }));

    try {
      expect(
        await queryAxiomLogs(axiomBindings, { organizationId: 'org-1' })
      ).toEqual({ kind: 'query_failed' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('buildAxiomLogQuery', () => {
  test('builds a search-based log query with filters and a cursor', () => {
    const query = buildAxiomLogQuery({
      cursor: '2026-09-28T00:00:00.000Z',
      functionSlug: 'support/extend-access',
      handle: 'acme',
      level: ['error', 'warn'],
      limit: 500,
      message: 'failed',
      organizationId: 'org-1',
      packageSlug: 'billing',
    });

    expect(query).toContain('search "org-1"');
    expect(query).not.toContain('"type":"log"');
    expect(query).toContain('search "\\"handle\\":\\"acme\\""');
    expect(query).toContain(
      'search "\\"level\\":\\"error\\"" or "\\"level\\":\\"warn\\""'
    );
    expect(query).not.toContain(
      'search "\\"level\\":\\"error\\"" | search "\\"level\\":\\"warn\\""'
    );
    expect(query).toContain('search "failed"');
    expect(query).toContain('_time < datetime(');
    expect(query).toContain('sort by _time desc');
    expect(query).toContain('limit 100');
  });

  test('builds an execution query with the minimum limit', () => {
    const query = buildAxiomLogQuery({
      executionId: 'execution-1',
      level: ['error'],
      limit: 0,
      organizationId: 'org-1',
    });

    expect(query).toContain('search "execution-1"');
    expect(query).toContain('limit 1');
  });

  test('sorts oldest first and pages forward from the cursor', () => {
    const query = buildAxiomLogQuery({
      cursor: '2026-09-28T00:00:00.000Z',
      organizationId: 'org-1',
      sortDirection: 'asc',
    });

    expect(query).toContain('_time > datetime(');
    expect(query).toContain('sort by _time asc');
  });
});

describe('axiom apl helpers', () => {
  test('indexes telemetry fields and builds search clauses', () => {
    expect(
      withTelemetryIndexFields({
        executionId: 'exec-1',
        functionSlug: 'hello',
        handle: 'acme',
        organizationId: 'org-1',
        packageSlug: 'billing',
        type: 'log',
        versionId: 'ver-1',
      })
    ).toMatchObject({
      ft_event_type: 'log',
      ft_execution_id: 'exec-1',
      ft_handle: 'acme',
      ft_org_id: 'org-1',
      ft_package_slug: 'billing',
    });
    expect(aplSearch('org-1')).toBe('search "org-1"');
    expect(aplJsonFieldSearch('handle', 'acme')).toBe(
      'search "\\"handle\\":\\"acme\\""'
    );
    expect(aplJsonFieldSearchAny('level', ['error', 'warn', 'error'])).toBe(
      'search "\\"level\\":\\"error\\"" or "\\"level\\":\\"warn\\""'
    );
    expect(aplJsonFieldSearchAny('level', ['error'])).toBe(
      'search "\\"level\\":\\"error\\""'
    );
    expect(aplJsonFieldSearchAny('level', ['', '  '])).toBeNull();
  });

  test('classifies telemetry records', () => {
    expect(isTelemetryLogRecord({ type: 'log' })).toBe(true);
    expect(isTelemetryLogRecord({ type: 'execution' })).toBe(false);
    expect(isTelemetryLogRecord({ message: 'hello' })).toBe(true);
    expect(isTelemetryExecutionRecord({ type: 'execution' })).toBe(true);
    expect(isTelemetryExecutionRecord({ input: {}, output: {} })).toBe(true);
    expect(isTelemetryExecutionRecord({ message: 'hello' })).toBe(false);
  });
});

describe('filterTelemetryRecordsByPackages', () => {
  test('returns no rows when package scope is empty', () => {
    expect(
      filterTelemetryRecordsByPackages(
        [{ message: 'hello', organizationId: 'org-1' }],
        [],
        'org-1'
      )
    ).toEqual([]);
  });

  test('keeps rows that match an accessible package', () => {
    expect(
      filterTelemetryRecordsByPackages(
        [
          {
            handle: 'acme',
            message: 'ok',
            organizationId: 'org-1',
            packageSlug: 'billing',
          },
          {
            ft_handle: 'acme',
            ft_org_id: 'org-1',
            ft_package_slug: 'other',
            message: 'skip',
          },
        ],
        [{ handle: 'acme', packageSlug: 'billing' }],
        'org-1'
      )
    ).toEqual([
      {
        handle: 'acme',
        message: 'ok',
        organizationId: 'org-1',
        packageSlug: 'billing',
      },
    ]);
  });

  test('matches partial handle or package slug', () => {
    expect(
      filterTelemetryRecordsByPackages(
        [{ handle: 'acme', organizationId: 'org-1' }],
        [{ handle: 'acme', packageSlug: 'billing' }],
        'org-1'
      )
    ).toHaveLength(1);
    expect(
      filterTelemetryRecordsByPackages(
        [{ organizationId: 'org-1', packageSlug: 'billing' }],
        [{ handle: 'acme', packageSlug: 'billing' }],
        'org-1'
      )
    ).toHaveLength(1);
  });

  test('keeps org-scoped rows when handle and package slug are missing', () => {
    expect(
      filterTelemetryRecordsByPackages(
        [{ ft_org_id: 'org-1', message: 'started with {}' }],
        [{ handle: 'acme', packageSlug: 'billing' }],
        'org-1'
      )
    ).toEqual([{ ft_org_id: 'org-1', message: 'started with {}' }]);
  });
});

describe('filterDashboardTelemetryRecords', () => {
  test('returns execution payload for a specific execution id', () => {
    expect(
      filterDashboardTelemetryRecords(
        [
          {
            executionId: 'exec-1',
            ft_org_id: 'org-1',
            input: {},
            output: {},
            type: 'execution',
          },
          {
            executionId: 'exec-2',
            ft_org_id: 'org-1',
            input: {},
            output: {},
            type: 'execution',
          },
        ],
        {
          executionId: 'exec-1',
          organizationId: 'org-1',
          packages: [{ handle: 'acme', packageSlug: 'billing' }],
        }
      )
    ).toEqual([
      {
        executionId: 'exec-1',
        ft_org_id: 'org-1',
        input: {},
        output: {},
        type: 'execution',
      },
    ]);
  });

  test('drops execution events from the log list', () => {
    expect(
      filterDashboardTelemetryRecords(
        [
          {
            ft_org_id: 'org-1',
            message: 'started with {}',
            type: 'log',
          },
          {
            ft_org_id: 'org-1',
            input: {},
            output: {},
            type: 'execution',
          },
        ],
        {
          organizationId: 'org-1',
          packages: [{ handle: 'acme', packageSlug: 'billing' }],
        }
      )
    ).toEqual([
      {
        ft_org_id: 'org-1',
        message: 'started with {}',
        type: 'log',
      },
    ]);
  });
});
