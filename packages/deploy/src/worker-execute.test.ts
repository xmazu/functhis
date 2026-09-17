import { describe, expect, test } from 'bun:test';

import { StoredBundleLoadError } from './bundle-load-error';
import { loadStoredBundle, runDynamicWorker } from './worker-execute';

describe('loadStoredBundle', () => {
  test('throws when KV is empty', async () => {
    await expect(
      loadStoredBundle(
        {
          BUNDLES: {
            get: () => Promise.resolve(null),
          },
        },
        'abc123'
      )
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  test('throws when KV JSON is invalid', async () => {
    await expect(
      loadStoredBundle(
        {
          BUNDLES: {
            get: () => Promise.resolve('not-json'),
          },
        },
        'abc123'
      )
    ).rejects.toBeInstanceOf(StoredBundleLoadError);
  });
});

describe('runDynamicWorker', () => {
  test('preserves non-OK worker HTTP status', async () => {
    const result = await runDynamicWorker(
      {
        LOADER: {
          get: () => ({
            getEntrypoint: () => ({
              fetch: () =>
                Promise.resolve(
                  Response.json({ error: 'bad input' }, { status: 422 })
                ),
            }),
          }),
        },
      },
      {
        bundle: { mainModule: 'main.ts', modules: { 'main.ts': '' } },
        functionSlug: 'hello',
        requestBytes: 10,
        runInput: {},
        versionId: 'ver_test',
      }
    );

    expect(result.httpStatus).toBe(422);
    expect(result.status).toBe('error');
  });
});
