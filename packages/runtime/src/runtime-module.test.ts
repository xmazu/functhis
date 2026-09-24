import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createRuntimeModuleSource } from './index';
import type { RuntimeStore } from './isolate/runtime';
import { __runInRuntime, context, secret } from './isolate/runtime';

const tempDirs: string[] = [];

const loadBuiltRuntimeModule = async (): Promise<{
  __runInRuntime: typeof __runInRuntime;
  context: typeof context;
  secret: typeof secret;
}> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'functhis-runtime-mod-'));
  tempDirs.push(dir);
  const modulePath = path.join(dir, '__functhis_runtime.mjs');
  await writeFile(modulePath, createRuntimeModuleSource(), 'utf-8');
  return import(modulePath) as Promise<{
    __runInRuntime: typeof __runInRuntime;
    context: typeof context;
    secret: typeof secret;
  }>;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe('isolate/runtime', () => {
  test('isolates concurrent invocations via AsyncLocalStorage', async () => {
    const runA = __runInRuntime(
      {
        context: {
          callerUserId: null,
          executionId: 'exec-a',
          functionSlug: 'a',
          packageVersionId: 'ver-a',
        },
        secrets: { KEY: 'alpha' },
      },
      async () => {
        await Bun.sleep(5);
        return { ctx: context(), key: secret('KEY') };
      }
    );

    const runB = __runInRuntime(
      {
        context: {
          callerUserId: 'user-1',
          executionId: 'exec-b',
          functionSlug: 'b',
          packageVersionId: 'ver-b',
        },
        secrets: { KEY: 'beta' },
      },
      async () => {
        await Bun.sleep(1);
        return { ctx: context(), key: secret('KEY') };
      }
    );

    const [a, b] = await Promise.all([runA, runB]);
    expect(a).toEqual({
      ctx: {
        callerUserId: null,
        executionId: 'exec-a',
        functionSlug: 'a',
        packageVersionId: 'ver-a',
      },
      key: 'alpha',
    });
    expect(b).toEqual({
      ctx: {
        callerUserId: 'user-1',
        executionId: 'exec-b',
        functionSlug: 'b',
        packageVersionId: 'ver-b',
      },
      key: 'beta',
    });
  });

  test('secret throws when name is missing', async () => {
    await expect(
      __runInRuntime(
        {
          context: {
            callerUserId: null,
            executionId: 'exec',
            functionSlug: 'fn',
            packageVersionId: 'ver',
          },
          secrets: {},
        },
        () => {
          secret('MISSING');
          return Promise.resolve();
        }
      )
    ).rejects.toThrow(/Secret "MISSING" is not set/u);
  });

  test('context throws outside an invocation', () => {
    expect(() => context()).toThrow(
      /functhis:runtime context is not available outside an invocation/u
    );
  });
});

describe('createRuntimeModuleSource', () => {
  test('matches the built isolate entry', async () => {
    expect(createRuntimeModuleSource()).toContain('AsyncLocalStorage');
    const mod = await loadBuiltRuntimeModule();
    const store: RuntimeStore = {
      context: {
        callerUserId: null,
        executionId: 'exec',
        functionSlug: 'fn',
        packageVersionId: 'ver',
      },
      secrets: { TOKEN: 'local' },
    };
    const result = await mod.__runInRuntime(store, () => ({
      ctx: mod.context(),
      token: mod.secret('TOKEN'),
    }));
    expect(result).toEqual({ ctx: store.context, token: 'local' });
  });
});
