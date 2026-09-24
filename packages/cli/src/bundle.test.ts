import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createRuntimeModuleSource } from '@functhis/runtime';

import { createBootstrapSource } from './bundle';
import type { DiscoveredFunction } from './discover';

const sampleFunction = (
  overrides?: Partial<DiscoveredFunction>
): DiscoveredFunction => ({
  contract: { description: 'Say hello' },
  exportName: 'default',
  path: 'hello.ts',
  slug: 'hello',
  ...overrides,
});

describe('createBootstrapSource', () => {
  test('routes functionSlug to the matching default export handler', async () => {
    const source = createBootstrapSource([
      sampleFunction({
        path: 'hello.ts',
        slug: 'hello',
      }),
    ]);

    const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bootstrap-'));
    const handlerPath = path.join(tempDir, 'hello.ts');
    await writeFile(
      handlerPath,
      'export default function hello(input: { name?: string }) {\n  return { message: "Hi " + (input.name ?? "world") };\n}\n',
      'utf-8'
    );
    const bootstrapPath = path.join(tempDir, 'bootstrap.mjs');
    await writeFile(bootstrapPath, source, 'utf-8');
    await writeFile(
      path.join(tempDir, '__functhis_runtime.mjs'),
      createRuntimeModuleSource(),
      'utf-8'
    );

    try {
      const mod = (await import(bootstrapPath)) as {
        default: { fetch: (request: Request) => Promise<Response> };
      };
      const response = await mod.default.fetch(
        new Request('http://local/run', {
          body: JSON.stringify({
            functionSlug: 'hello',
            input: { name: 'Ada' },
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
      );
      const body = (await response.json()) as {
        result: { message: string };
      };
      expect(body.result.message).toBe('Hi Ada');
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test('returns 404 for unknown function slug', async () => {
    const source = createBootstrapSource([sampleFunction()]);
    const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bootstrap-'));
    const handlerPath = path.join(tempDir, 'hello.ts');
    await writeFile(
      handlerPath,
      'export default () => ({ ok: true });\n',
      'utf-8'
    );
    const bootstrapPath = path.join(tempDir, 'bootstrap.mjs');
    await writeFile(bootstrapPath, source, 'utf-8');
    await writeFile(
      path.join(tempDir, '__functhis_runtime.mjs'),
      createRuntimeModuleSource(),
      'utf-8'
    );
    try {
      const mod = (await import(bootstrapPath)) as {
        default: { fetch: (request: Request) => Promise<Response> };
      };
      const response = await mod.default.fetch(
        new Request('http://local/run', {
          body: JSON.stringify({ functionSlug: 'missing' }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
      );
      expect(response.status).toBe(404);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
