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

  test('context and secret throw outside an invocation', () => {
    expect(() => context()).toThrow(/context is not available/u);
    expect(() => secret('TOKEN')).toThrow(/secret is not available/u);
  });

  test('allows fetch without an allowlist and accepts URL or Request inputs', async () => {
    const server = Bun.serve({
      fetch: () => new Response('ok'),
      hostname: '127.0.0.1',
      port: 0,
    });
    const href = `http://127.0.0.1:${server.port}/`;
    const store = {
      context: {
        callerUserId: null,
        executionId: 'exec',
        functionSlug: 'fn',
        packageVersionId: 'ver',
      },
      secrets: {},
    };
    try {
      const fromUrl = await __runInRuntime(store, () => fetch(new URL(href)));
      expect(await (fromUrl as Response).text()).toBe('ok');
      const fromRequest = await __runInRuntime(store, () =>
        fetch(new Request(href))
      );
      expect(await (fromRequest as Response).text()).toBe('ok');
      await expect(
        __runInRuntime({ ...store, hostAllowlist: ['127.0.0.1'] }, () =>
          fetch('not a url')
        )
      ).rejects.toThrow(/allowlist/u);
    } finally {
      server.stop(true);
    }
  });

  test('blocks fetch when an allowlist is set', async () => {
    const server = Bun.serve({
      fetch: () => new Response('ok'),
      hostname: '127.0.0.1',
      port: 0,
    });
    try {
      await expect(
        __runInRuntime(
          {
            context: {
              callerUserId: null,
              executionId: 'exec',
              functionSlug: 'fn',
              packageVersionId: 'ver',
            },
            hostAllowlist: ['127.0.0.1'],
            secrets: {},
          },
          () => fetch('https://evil.test/x')
        )
      ).rejects.toThrow(/allowlist/u);
      const allowed = await __runInRuntime(
        {
          context: {
            callerUserId: null,
            executionId: 'exec',
            functionSlug: 'fn',
            packageVersionId: 'ver',
          },
          hostAllowlist: ['127.0.0.1'],
          secrets: {},
        },
        () => fetch(`http://127.0.0.1:${server.port}/`)
      );
      expect(allowed).toBeInstanceOf(Response);
      expect(await (allowed as Response).text()).toBe('ok');
    } finally {
      server.stop(true);
    }
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
