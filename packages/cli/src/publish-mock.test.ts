import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { saveConfig } from './config';
import { runPublish, runRollback } from './publish';

let previousFetch: typeof fetch;
let previousHome: string | undefined;

beforeEach(() => {
  previousFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  process.env.HOME = previousHome;
});

describe('runPublish (mocked API)', () => {
  test('calls start and finalize with bearer token', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-deploy-mock-'));
    process.env.HOME = home;
    const calls: string[] = [];

    globalThis.fetch = ((
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(url);
      if (url.endsWith('/api/publish/start')) {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer test-token',
        });
        return Promise.resolve(
          Response.json({ packageId: 'pkg_test' }, { status: 200 })
        );
      }
      if (url.endsWith('/api/publish/finalize')) {
        return Promise.resolve(
          Response.json(
            {
              artifactKey: 'artifacts/sha256/ab/abc',
              bundleHash: 'abc123456789',
              bundleKvKey: 'deadbeef',
              currentVersionId: 'ver_1',
              functions: [{ slug: 'hello' }],
              handle: 'dev',
              packageId: 'pkg_test',
              semver: '1.0.0',
              slug: 'hello-world',
              versionId: 'ver_1',
            },
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      const projectRoot = await mkdtemp(
        path.join(tmpdir(), 'functhis-publish-proj-')
      );
      await writeFile(
        path.join(projectRoot, 'package.json'),
        JSON.stringify({ name: 'hello-world' }),
        'utf-8'
      );
      await writeFile(
        path.join(projectRoot, 'hello.ts'),
        'export default function hello(input: { name?: string }) { return { message: input.name }; }\n',
        'utf-8'
      );
      try {
        await runPublish({
          projectRoot,
          slug: 'hello-world',
        });
        expect(calls).toEqual([
          'http://localhost:3001/api/publish/start',
          'http://localhost:3001/api/publish/finalize',
        ]);
      } finally {
        await rm(projectRoot, { force: true, recursive: true });
      }
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('sends scope and visibility on start and writes package identity', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-deploy-scope-'));
    process.env.HOME = home;
    let startBody: Record<string, unknown> | undefined;

    globalThis.fetch = ((
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/publish/start')) {
        startBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Promise.resolve(
          Response.json({ packageId: 'pkg_test' }, { status: 200 })
        );
      }
      if (url.endsWith('/api/publish/finalize')) {
        return Promise.resolve(
          Response.json(
            {
              artifactKey: 'artifacts/sha256/ab/abc',
              bundleHash: 'abc123456789',
              bundleKvKey: 'deadbeef',
              currentVersionId: 'ver_1',
              functions: [{ slug: 'hello' }],
              handle: 'acme',
              packageId: 'pkg_test',
              semver: '1.0.0',
              slug: 'hello-world',
              versionId: 'ver_1',
            },
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      const projectRoot = await mkdtemp(
        path.join(tmpdir(), 'functhis-publish-scope-')
      );
      const packageJsonPath = path.join(projectRoot, 'package.json');
      await writeFile(
        packageJsonPath,
        JSON.stringify({ name: 'hello-world' }),
        'utf-8'
      );
      await writeFile(
        path.join(projectRoot, 'hello.ts'),
        'export default function hello(input: { name?: string }) { return { message: input.name }; }\n',
        'utf-8'
      );
      try {
        await runPublish({
          projectRoot,
          scope: 'acme',
          slug: 'hello-world',
          visibility: 'library',
        });
        expect(startBody).toMatchObject({
          scope: 'acme',
          slug: 'hello-world',
          visibility: 'library',
        });
        const written = JSON.parse(
          await readFile(packageJsonPath, 'utf-8')
        ) as {
          functhis?: { scope?: string };
        };
        expect(written.functhis?.scope).toBe('acme');
      } finally {
        await rm(projectRoot, { force: true, recursive: true });
      }
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('rejects an unexpected finalize payload', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-deploy-bad-'));
    process.env.HOME = home;

    globalThis.fetch = ((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/publish/start')) {
        return Promise.resolve(
          Response.json({ packageId: 'pkg_test' }, { status: 200 })
        );
      }
      if (url.endsWith('/api/publish/finalize')) {
        return Promise.resolve(Response.json({ ok: false }, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      const projectRoot = await mkdtemp(
        path.join(tmpdir(), 'functhis-publish-bad-')
      );
      await writeFile(
        path.join(projectRoot, 'package.json'),
        JSON.stringify({ name: 'hello-world' }),
        'utf-8'
      );
      await writeFile(
        path.join(projectRoot, 'hello.ts'),
        'export default function hello() { return {}; }\n',
        'utf-8'
      );
      try {
        await expect(
          runPublish({ projectRoot, slug: 'hello-world' })
        ).rejects.toThrow(/unexpected response/u);
      } finally {
        await rm(projectRoot, { force: true, recursive: true });
      }
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('maps 401 from start to a login hint', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-deploy-401-'));
    process.env.HOME = home;

    globalThis.fetch = ((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/publish/start')) {
        return Promise.resolve(new Response('unauthorized', { status: 401 }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      await expect(
        runPublish({
          projectRoot: path.join(
            import.meta.dirname,
            '../../../examples/hello-world'
          ),
          slug: 'hello-world',
        })
      ).rejects.toThrow(/functhis login/u);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('rejects changing a stored package scope', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-scope-change-'));
    process.env.HOME = home;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      const projectRoot = await mkdtemp(
        path.join(tmpdir(), 'functhis-scope-proj-')
      );
      await writeFile(
        path.join(projectRoot, 'package.json'),
        JSON.stringify({
          functhis: { scope: 'acme' },
          name: 'hello-world',
        }),
        'utf-8'
      );
      await writeFile(
        path.join(projectRoot, 'hello.ts'),
        'export default function hello() { return {}; }\n',
        'utf-8'
      );
      try {
        await expect(
          runPublish({
            projectRoot,
            scope: 'other',
            slug: 'hello-world',
          })
        ).rejects.toThrow(/Cannot change package scope/u);
      } finally {
        await rm(projectRoot, { force: true, recursive: true });
      }
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});

describe('runRollback (mocked API)', () => {
  test('posts semver to /api/publish/rollback', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-rollback-mock-'));
    process.env.HOME = home;

    globalThis.fetch = ((
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      expect(url).toBe('http://localhost:3001/api/publish/rollback');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      });
      const body = JSON.parse(String(init?.body)) as { semver: string };
      expect(body.semver).toBe('1.0.0');
      return Promise.resolve(
        Response.json(
          {
            currentVersionId: 'ver_1',
            handle: 'dev',
            packageId: 'pkg_test',
            semver: '1.0.0',
            slug: 'hello-world',
          },
          { status: 200 }
        )
      );
    }) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      const projectRoot = await mkdtemp(
        path.join(tmpdir(), 'functhis-rollback-proj-')
      );
      await writeFile(
        path.join(projectRoot, 'package.json'),
        JSON.stringify({ name: 'hello-world' }),
        'utf-8'
      );
      try {
        await runRollback({
          projectRoot,
          semver: '1.0.0',
          slug: 'hello-world',
        });
      } finally {
        await rm(projectRoot, { force: true, recursive: true });
      }
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('rejects an unexpected rollback payload', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-rollback-bad-'));
    process.env.HOME = home;

    globalThis.fetch = ((): Promise<Response> =>
      Promise.resolve(
        Response.json({ ok: false }, { status: 200 })
      )) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      await expect(
        runRollback({
          projectRoot: path.join(
            import.meta.dirname,
            '../../../examples/hello-world'
          ),
          semver: '1.0.0',
          slug: 'hello-world',
        })
      ).rejects.toThrow(/unexpected response/u);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('surfaces a non-OK rollback response', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-rollback-err-'));
    process.env.HOME = home;

    globalThis.fetch = ((): Promise<Response> =>
      Promise.resolve(
        new Response('Unknown version 9.9.9', { status: 400 })
      )) as typeof fetch;

    try {
      await saveConfig({
        accessToken: 'test-token',
        consoleUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3001',
      });
      await expect(
        runRollback({
          projectRoot: path.join(
            import.meta.dirname,
            '../../../examples/hello-world'
          ),
          semver: '9.9.9',
          slug: 'hello-world',
        })
      ).rejects.toThrow(/Unknown version 9\.9\.9/u);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});
