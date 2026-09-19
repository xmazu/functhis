import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { saveConfig } from './config';
import { runDeploy } from './deploy';

let previousFetch: typeof fetch;
let previousHome: string | undefined;

beforeEach(() => {
  previousFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  process.env.HOME = previousHome;
});

describe('runDeploy (mocked API)', () => {
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
      if (url.endsWith('/api/deploy/start')) {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer test-token',
        });
        return Promise.resolve(
          Response.json({ packageId: 'pkg_test' }, { status: 200 })
        );
      }
      if (url.endsWith('/api/deploy/finalize')) {
        return Promise.resolve(
          Response.json(
            {
              bundleHash: 'abc123456789',
              bundleKvKey: 'deadbeef',
              currentVersionId: 'ver_1',
              functions: [{ slug: 'hello' }],
              handle: 'dev',
              packageId: 'pkg_test',
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
        consoleUrl: 'http://localhost:3002',
        webUrl: 'http://localhost:3001',
      });
      await runDeploy({
        projectRoot: path.join(
          import.meta.dirname,
          '../../../examples/hello-world'
        ),
        slug: 'hello-world',
      });
      expect(calls).toEqual([
        'http://localhost:3001/api/deploy/start',
        'http://localhost:3001/api/deploy/finalize',
      ]);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});
