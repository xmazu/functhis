import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildWorkerBundle } from './build-bundle';
import { discoverProject } from './discover';
import type { DiscoveredFunction } from './discover';

const KEEP_TOKEN = 'tiny-dep-keep-token-7f3a';
const DROP_TOKEN = 'tiny-dep-drop-token-9b2c';
const ORPHAN_TOKEN = 'orphan-file-token-4c1d';

const tempRoots: string[] = [];

const makeTinyDepProject = async (options?: {
  handlerSource?: string;
  includeOrphan?: boolean;
}): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'functhis-bundle-fixture-'));
  tempRoots.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', type: 'module' }),
    'utf-8'
  );
  const depRoot = path.join(root, 'node_modules', 'tiny-dep');
  await mkdir(depRoot, { recursive: true });
  await writeFile(
    path.join(depRoot, 'package.json'),
    JSON.stringify({
      exports: './index.js',
      name: 'tiny-dep',
      type: 'module',
    }),
    'utf-8'
  );
  await writeFile(
    path.join(depRoot, 'index.js'),
    `export const KEEP_TOKEN = '${KEEP_TOKEN}';\nexport const DROP_TOKEN = '${DROP_TOKEN}';\n`,
    'utf-8'
  );
  const handlerSource =
    options?.handlerSource ??
    `import { KEEP_TOKEN } from 'tiny-dep';\nexport default function hello() {\n  return { message: KEEP_TOKEN };\n}\n`;
  await writeFile(path.join(root, 'hello.ts'), handlerSource, 'utf-8');
  if (options?.includeOrphan) {
    await writeFile(
      path.join(root, 'orphan.ts'),
      `export default function orphan() {\n  return '${ORPHAN_TOKEN}';\n}\n`,
      'utf-8'
    );
  }
  return root;
};

const sampleFunction = (
  overrides?: Partial<DiscoveredFunction>
): DiscoveredFunction => ({
  contract: { description: 'hello' },
  exportName: 'default',
  path: 'hello.ts',
  slug: 'hello',
  ...overrides,
});

const runBundledFetch = async (
  code: string,
  slug: string,
  input: unknown = {}
): Promise<Response> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bundle-run-'));
  const modulePath = path.join(tempDir, 'out.mjs');
  await writeFile(modulePath, code, 'utf-8');
  try {
    const mod = (await import(modulePath)) as {
      default: { fetch: (request: Request) => Promise<Response> };
    };
    return mod.default.fetch(
      new Request('http://local/run', {
        body: JSON.stringify({ functionSlug: slug, input }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('buildWorkerBundle', () => {
  test('esbuild bundles discovered hello-world sources', async () => {
    const packageRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    const { files, functions } = await discoverProject(packageRoot);
    const bundle = await buildWorkerBundle({ files, functions, packageRoot });

    expect(bundle.mainModule).toBe('bundle.mjs');
    expect(bundle.modules['bundle.mjs']?.length).toBeGreaterThan(100);
    expect(bundle.bundleHash).toMatch(/^[\da-f]{64}$/u);

    const response = await runBundledFetch(
      bundle.modules['bundle.mjs'] ?? '',
      'hello',
      { name: 'Functhis' }
    );
    const body = (await response.json()) as { result: { message: string } };
    expect(body.result.message).toBe('Hello, Functhis!');
  });

  test('inlines npm dependencies from packageRoot node_modules', async () => {
    const packageRoot = await makeTinyDepProject();
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
    };
    const functions = [sampleFunction()];
    const bundle = await buildWorkerBundle({ files, functions, packageRoot });
    const code = bundle.modules['bundle.mjs'] ?? '';

    expect(code).toContain(KEEP_TOKEN);
    expect(code).not.toMatch(/from\s+['"]tiny-dep['"]/u);

    const response = await runBundledFetch(code, 'hello');
    const body = (await response.json()) as { result: { message: string } };
    expect(body.result.message).toBe(KEEP_TOKEN);
  });

  test('tree-shakes unused exports and unreferenced source files', async () => {
    const packageRoot = await makeTinyDepProject({ includeOrphan: true });
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
      'orphan.ts': await Bun.file(path.join(packageRoot, 'orphan.ts')).text(),
    };
    const functions = [sampleFunction()];
    const bundle = await buildWorkerBundle({ files, functions, packageRoot });
    const code = bundle.modules['bundle.mjs'] ?? '';

    expect(code).toContain(KEEP_TOKEN);
    expect(code).not.toContain(DROP_TOKEN);
    expect(code).not.toContain(ORPHAN_TOKEN);
  });

  test('rejects child_process in author source', async () => {
    const packageRoot = await makeTinyDepProject({
      handlerSource:
        "import { spawn } from 'child_process';\nexport default async () => ({ ok: true });\n",
    });
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
    };
    await expect(
      buildWorkerBundle({
        files,
        functions: [sampleFunction()],
        packageRoot,
      })
    ).rejects.toThrow(/child_process/u);
  });

  test('rejects node:fs in author source', async () => {
    const packageRoot = await makeTinyDepProject({
      handlerSource:
        "import fs from 'node:fs';\nexport default async () => ({ ok: true });\n",
    });
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
    };
    await expect(
      buildWorkerBundle({
        files,
        functions: [sampleFunction()],
        packageRoot,
      })
    ).rejects.toThrow(/fs/u);
  });

  test('rejects native .node imports', async () => {
    const packageRoot = await makeTinyDepProject({
      handlerSource:
        "import addon from './native.node';\nexport default async () => addon;\n",
    });
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
    };
    await expect(
      buildWorkerBundle({
        files,
        functions: [sampleFunction()],
        packageRoot,
      })
    ).rejects.toThrow(/Native addon/u);
  });

  test('rejects dynamic import of npm packages', async () => {
    const packageRoot = await makeTinyDepProject({
      handlerSource: "export default async () => import('lodash');\n",
    });
    const files = {
      'hello.ts': await Bun.file(path.join(packageRoot, 'hello.ts')).text(),
    };
    await expect(
      buildWorkerBundle({
        files,
        functions: [sampleFunction()],
        packageRoot,
      })
    ).rejects.toThrow(/dynamic import/u);
  });
});
