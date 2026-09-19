import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildWorkerBundle } from './build-bundle';
import { discoverProject } from './discover';

describe('buildWorkerBundle', () => {
  test('esbuild bundles discovered hello-world sources', async () => {
    const projectRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    const { files, functions } = await discoverProject(projectRoot);
    const bundle = await buildWorkerBundle({ files, functions });

    expect(bundle.mainModule).toBe('out.js');
    expect(bundle.modules['out.js']?.length).toBeGreaterThan(100);
    expect(bundle.bundleHash).toMatch(/^[\da-f]{64}$/u);

    const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bundle-run-'));
    const modulePath = path.join(tempDir, 'out.mjs');
    await Bun.write(modulePath, bundle.modules['out.js'] ?? '');
    try {
      const mod = (await import(modulePath)) as {
        default: { fetch: (request: Request) => Promise<Response> };
      };
      const response = await mod.default.fetch(
        new Request('http://local/run', {
          body: JSON.stringify({
            functionSlug: 'hello',
            input: { name: 'Functhis' },
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
      );
      const body = (await response.json()) as {
        result: { message: string };
      };
      expect(body.result.message).toBe('Hello, Functhis!');
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
