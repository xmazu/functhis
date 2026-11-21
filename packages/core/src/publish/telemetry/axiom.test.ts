import { describe, expect, test } from 'bun:test';

import {
  buildAxiomQueryUrl,
  buildExecutionLifecycleLogs,
  ingestAxiomEvents,
  queryAxiom,
  readAxiomQueryRecords,
} from './axiom';

describe('readAxiomQueryRecords', () => {
  test('reads rows from apl matches envelope', () => {
    expect(
      readAxiomQueryRecords({
        matches: [{ executionId: 'exec-1' }],
      })
    ).toEqual([{ executionId: 'exec-1' }]);
  });

  test('reads rows from a tabular apl envelope', () => {
    expect(
      readAxiomQueryRecords({
        tables: [
          {
            columns: [['exec-1'], ['started with {}']],
            fields: [{ name: 'executionId' }, { name: 'message' }],
          },
        ],
      })
    ).toEqual([{ executionId: 'exec-1', message: 'started with {}' }]);
  });
});

describe('Axiom query routing', () => {
  test('queries via the central tabular APL API', () => {
    expect(buildAxiomQueryUrl()).toBe(
      'https://api.axiom.co/v1/datasets/_apl?format=tabular'
    );
  });

  test('scopes a filter to the dataset and posts it centrally', async () => {
    const originalFetch = globalThis.fetch;
    let url = '';
    let apl = '';
    globalThis.fetch = (input, init) => {
      url = String(input);
      apl = JSON.parse(String(init?.body)).apl as string;
      return Promise.resolve(Response.json({ tables: [] }));
    };

    try {
      await queryAxiom(
        {
          AXIOM_API_TOKEN: 'token',
          AXIOM_DATASET: 'functhis_executions',
          AXIOM_EDGE: 'eu-central-1.aws.edge.axiom.co',
        },
        `search "org"`
      );
      expect(url).toBe('https://api.axiom.co/v1/datasets/_apl?format=tabular');
      expect(apl).toBe(`['functhis_executions'] | search "org"`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('buildExecutionLifecycleLogs', () => {
  test('records the input the run started with and the output it produced', () => {
    expect(
      buildExecutionLifecycleLogs({
        completedAt: '2026-09-28T10:00:01.000Z',
        executionId: 'exec-1',
        functionSlug: 'hello',
        handle: 'acme',
        input: { name: 'Ada' },
        organizationId: 'org-1',
        output: { ok: true },
        packageSlug: 'greet',
        startedAt: '2026-09-28T10:00:00.000Z',
        status: 'ok',
        versionId: 'ver_1',
      })
    ).toEqual([
      {
        executionId: 'exec-1',
        ft_event_type: 'log',
        ft_execution_id: 'exec-1',
        ft_function_slug: 'hello',
        ft_handle: 'acme',
        ft_org_id: 'org-1',
        ft_package_slug: 'greet',
        ft_version_id: 'ver_1',
        functionSlug: 'hello',
        handle: 'acme',
        level: 'info',
        message: 'started with {"name":"Ada"}',
        organizationId: 'org-1',
        packageSlug: 'greet',
        timestamp: '2026-09-28T10:00:00.000Z',
        type: 'log',
        versionId: 'ver_1',
      },
      {
        executionId: 'exec-1',
        ft_event_type: 'log',
        ft_execution_id: 'exec-1',
        ft_function_slug: 'hello',
        ft_handle: 'acme',
        ft_org_id: 'org-1',
        ft_package_slug: 'greet',
        ft_version_id: 'ver_1',
        functionSlug: 'hello',
        handle: 'acme',
        level: 'info',
        message: 'produced {"ok":true}',
        organizationId: 'org-1',
        packageSlug: 'greet',
        timestamp: '2026-09-28T10:00:01.000Z',
        type: 'log',
        versionId: 'ver_1',
      },
    ]);
  });
});

describe('Axiom failure handling', () => {
  test('does not reject execution when ingestion fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('Axiom unavailable'));

    try {
      await expect(
        ingestAxiomEvents(
          {
            AXIOM_API_TOKEN: 'token',
            AXIOM_DATASET: 'functhis_executions',
          },
          [{ executionId: 'exec-1' }]
        )
      ).resolves.toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('ignores non-OK ingest responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response('forbidden', { status: 403 }));

    try {
      await expect(
        ingestAxiomEvents(
          {
            AXIOM_API_TOKEN: 'token',
            AXIOM_DATASET: 'functhis_executions',
          },
          [{ executionId: 'exec-1' }]
        )
      ).resolves.toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('resolves Secrets Store bindings before ingest', async () => {
    const originalFetch = globalThis.fetch;
    let authorization = '';
    globalThis.fetch = (_url, init) => {
      authorization =
        typeof init?.headers === 'object' &&
        init.headers !== null &&
        'authorization' in init.headers
          ? String((init.headers as Record<string, string>).authorization ?? '')
          : '';
      return Promise.resolve(new Response('{}', { status: 200 }));
    };

    try {
      await ingestAxiomEvents(
        {
          AXIOM_API_TOKEN: {
            get: () => Promise.resolve('resolved-token'),
          },
          AXIOM_DATASET: 'functhis_executions',
        },
        [{ executionId: 'exec-1' }]
      );
      expect(authorization).toBe('Bearer resolved-token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('returns unavailable data when Axiom query fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(Response.json({}, { status: 503 }));

    try {
      await expect(
        queryAxiom(
          {
            AXIOM_API_TOKEN: 'token',
            AXIOM_DATASET: 'functhis_executions',
          },
          '['
        )
      ).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
