import { describe, expect, test } from 'bun:test';

import { StoredBundleLoadError } from './bundle-load-error';
import { ExecutePayloadTooLargeError } from './quotas';
import {
  finalizeExecute,
  loadStoredBundle,
  runDynamicWorker,
  writeExecutionAnalytics,
} from './worker-execute';

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
  test('injects runtime module and passes runtime bag to fetch', async () => {
    let factoryConfig:
      | {
          compatibilityFlags?: string[];
          modules: Record<string, string | { js: string }>;
        }
      | undefined;
    let capturedBody: unknown;

    await runDynamicWorker(
      {
        LOADER: {
          get: (id, factory) => {
            expect(id).toBe('ver_test:2');
            factoryConfig = factory();
            return {
              getEntrypoint: () => ({
                fetch: async (request) => {
                  capturedBody = JSON.parse(await request.text());
                  return Response.json({ result: null });
                },
              }),
            };
          },
        },
      },
      {
        bundle: { mainModule: 'main.ts', modules: { 'main.ts': '' } },
        callerUserId: 'user-9',
        functionSlug: 'hello',
        requestBytes: 10,
        runInput: { ok: true },
        versionId: 'ver_test',
      }
    );

    expect(factoryConfig?.compatibilityFlags).toEqual(['nodejs_compat']);
    const runtimeModule = factoryConfig?.modules['./__functhis_runtime.mjs'];
    expect(runtimeModule).toEqual({
      js: expect.stringContaining('AsyncLocalStorage'),
    });
    expect(capturedBody).toMatchObject({
      functionSlug: 'hello',
      input: { ok: true },
      runtime: {
        context: {
          callerUserId: 'user-9',
          functionSlug: 'hello',
          packageVersionId: 'ver_test',
        },
        secrets: {},
      },
    });
  });

  test('passes published .mjs modules as explicit js objects for Worker Loader', async () => {
    let factoryConfig:
      | {
          mainModule: string;
          modules: Record<string, string | { js: string }>;
        }
      | undefined;

    await runDynamicWorker(
      {
        LOADER: {
          get: (_id, factory) => {
            factoryConfig = factory();
            return {
              getEntrypoint: () => ({
                fetch: () => Promise.resolve(Response.json({ result: null })),
              }),
            };
          },
        },
      },
      {
        bundle: {
          mainModule: 'bundle.mjs',
          modules: { 'bundle.mjs': 'export default {};' },
        },
        requestBytes: 1,
        runInput: {},
        versionId: 'ver_test',
      }
    );

    expect(factoryConfig?.mainModule).toBe('bundle.mjs');
    expect(factoryConfig?.modules['bundle.mjs']).toEqual({
      js: 'export default {};',
    });
    expect(factoryConfig?.modules['./__functhis_runtime.mjs']).toEqual({
      js: expect.stringContaining('AsyncLocalStorage'),
    });
  });

  test('forwards runtime secrets into the worker run body', async () => {
    let capturedBody: unknown;

    await runDynamicWorker(
      {
        LOADER: {
          get: (_id, factory) => {
            factory();
            return {
              getEntrypoint: () => ({
                fetch: async (request) => {
                  capturedBody = JSON.parse(await request.text());
                  return Response.json({ result: null });
                },
              }),
            };
          },
        },
      },
      {
        bundle: { mainModule: 'main.ts', modules: { 'main.ts': '' } },
        requestBytes: 1,
        runInput: {},
        runtimeSecrets: { API_KEY: 'shh' },
        versionId: 'ver_test',
      }
    );

    expect(capturedBody).toMatchObject({
      runtime: { secrets: { API_KEY: 'shh' } },
    });
  });

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

  test('invokes the loader factory and maps payload-too-large errors', async () => {
    let factoryCalled = false;
    const result = await runDynamicWorker(
      {
        LOADER: {
          get: (_id, factory) => {
            factory();
            factoryCalled = true;
            return {
              getEntrypoint: () => ({
                fetch: () =>
                  Promise.reject(
                    new ExecutePayloadTooLargeError('response', 9)
                  ),
              }),
            };
          },
        },
      },
      {
        bundle: { mainModule: 'main.ts', modules: { 'main.ts': '' } },
        requestBytes: 10,
        runInput: {},
        versionId: 'ver_test',
      }
    );
    expect(factoryCalled).toBe(true);
    expect(result.tooLarge).toBe(true);
    expect(result.httpStatus).toBe(413);
  });

  test('maps unexpected worker errors to a 500 JSON body', async () => {
    const result = await runDynamicWorker(
      {
        LOADER: {
          get: () => ({
            getEntrypoint: () => ({
              fetch: () => Promise.reject(new Error('boom')),
            }),
          }),
        },
      },
      {
        bundle: { mainModule: 'main.ts', modules: { 'main.ts': '' } },
        requestBytes: 4,
        runInput: {},
        versionId: 'ver_test',
      }
    );
    expect(result.httpStatus).toBe(500);
    expect(result.status).toBe('error');
    expect(result.responseText).toContain('boom');
  });
});

describe('loadStoredBundle success', () => {
  test('parses a stored JSON bundle', async () => {
    const bundle = {
      mainModule: 'main.ts',
      modules: { 'main.ts': 'export default {}' },
    };
    await expect(
      loadStoredBundle(
        {
          BUNDLES: {
            get: () => Promise.resolve(JSON.stringify(bundle)),
          },
        },
        'abc123'
      )
    ).resolves.toEqual(bundle);
  });
});

describe('writeExecutionAnalytics', () => {
  test('writes blobs, doubles, and the caller index', () => {
    const writes: unknown[] = [];
    writeExecutionAnalytics(
      {
        ANALYTICS: {
          writeDataPoint: (input) => {
            writes.push(input);
          },
        },
      },
      {
        callerUserId: 'user-1',
        durationMs: 12,
        functionSlug: 'hello',
        requestBytes: 3,
        responseBytes: 4,
        status: 'ok',
        versionId: 'ver_1',
      }
    );
    expect(writes).toEqual([
      {
        blobs: ['ver_1', 'hello', 'ok'],
        doubles: [12, 3, 4],
        indexes: ['user-1'],
      },
    ]);
  });
});

describe('finalizeExecute', () => {
  const loader = {
    get: () => ({
      getEntrypoint: () => ({
        fetch: () => Promise.resolve(new Response('{}')),
      }),
    }),
  };

  test('returns the worker response and swallows execution-row failures', async () => {
    const response = await finalizeExecute(
      {
        ANALYTICS: { writeDataPoint: () => {} },
        BUNDLES: { get: () => Promise.resolve(null) },
        LOADER: loader,
      } as never,
      {
        bundleHash: 'abcdefgh',
        functionSlug: 'hello',
        versionId: 'ver_1',
      },
      {
        durationMs: 5,
        httpStatus: 200,
        requestBytes: 1,
        responseBytes: 2,
        responseText: '{"ok":true}',
        status: 'ok',
        tooLarge: false,
      }
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
  });

  test('returns 413 when the run was too large', async () => {
    const response = await finalizeExecute(
      {
        ANALYTICS: { writeDataPoint: () => {} },
        BUNDLES: { get: () => Promise.resolve(null) },
        LOADER: loader,
      } as never,
      {
        bundleHash: 'abcdefgh',
        versionId: 'ver_1',
      },
      {
        durationMs: 5,
        httpStatus: 413,
        requestBytes: 1,
        responseBytes: 2,
        responseText: '{"error":"too_large"}',
        status: 'error',
        tooLarge: true,
      }
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'too_large' });
  });
});
