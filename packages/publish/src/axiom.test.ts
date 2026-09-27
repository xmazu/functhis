import { describe, expect, test } from 'bun:test';

import { ingestAxiomEvents, queryAxiom, readAxiomQueryRecords } from './axiom';

describe('readAxiomQueryRecords', () => {
  test('reads rows from apl matches envelope', () => {
    expect(
      readAxiomQueryRecords({
        matches: [{ executionId: 'exec-1' }],
      })
    ).toEqual([{ executionId: 'exec-1' }]);
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
