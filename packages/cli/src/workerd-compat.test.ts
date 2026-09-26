import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as esbuild from 'esbuild';

import { buildWorkerBundle } from './build-bundle';
import {
  isBannedNodeSpecifier,
  assertBundleHasNoBannedNodeImports,
  assertSourceHasNoBannedNodeImports,
  workerdCompatibilityPlugin,
} from './workerd-compat';

const buildWithPlugin = (contents: string): Promise<esbuild.BuildResult> =>
  esbuild.build({
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    platform: 'browser',
    plugins: [workerdCompatibilityPlugin()],
    stdin: { contents, loader: 'ts' },
    write: false,
  });

describe('isBannedNodeSpecifier', () => {
  test('rejects filesystem and child_process', () => {
    expect(isBannedNodeSpecifier('fs')).toBe(true);
    expect(isBannedNodeSpecifier('node:fs')).toBe(true);
    expect(isBannedNodeSpecifier('child_process')).toBe(true);
    expect(isBannedNodeSpecifier('async_hooks')).toBe(true);
    expect(isBannedNodeSpecifier('node:async_hooks')).toBe(true);
    expect(isBannedNodeSpecifier('zod')).toBe(false);
  });
});

describe('assertBundleHasNoBannedNodeImports', () => {
  test('allows ordinary ESM', () => {
    expect(() =>
      assertBundleHasNoBannedNodeImports('export default {}')
    ).not.toThrow();
  });

  test('rejects leftover node:fs imports', () => {
    expect(() =>
      assertBundleHasNoBannedNodeImports('import fs from "node:fs";')
    ).toThrow(/node:fs/u);
  });

  test('rejects process.dlopen leftovers', () => {
    expect(() =>
      assertBundleHasNoBannedNodeImports('process.dlopen(module, "x.node")')
    ).toThrow(/dlopen/u);
  });
});

describe('assertSourceHasNoBannedNodeImports', () => {
  test('rejects functhis/sdk/next in function sources', () => {
    expect(() =>
      assertSourceHasNoBannedNodeImports(
        "import { createHandler } from 'functhis/sdk/next';\nexport default async () => ({});\n"
      )
    ).toThrow(/Next.js app routes only/u);
  });

  test('rejects node:fs in unused author imports', () => {
    expect(() =>
      assertSourceHasNoBannedNodeImports(
        "import fs from 'node:fs';\nexport default async () => ({ ok: true });\n"
      )
    ).toThrow(/node:fs/u);
  });

  test('rejects native addons and process.dlopen', () => {
    expect(() =>
      assertSourceHasNoBannedNodeImports("import addon from './native.node';")
    ).toThrow(/Native addon/u);
    expect(() =>
      assertSourceHasNoBannedNodeImports('process.dlopen(module, "x.node")')
    ).toThrow(/dlopen/u);
  });

  test('allows ordinary ESM', () => {
    expect(() =>
      assertSourceHasNoBannedNodeImports('export default async () => ({});')
    ).not.toThrow();
  });
});

describe('workerdCompatibilityPlugin', () => {
  test('fails the bundle when sources import node:fs', async () => {
    const packageRoot = await mkdtemp(
      path.join(tmpdir(), 'functhis-workerd-bundle-')
    );
    await expect(
      buildWorkerBundle({
        files: {
          'hello.ts':
            "import fs from 'node:fs';\nexport default async () => ({ ok: true });\n",
        },
        functions: [
          {
            contract: { description: 'hello' },
            exportName: 'default',
            path: 'hello.ts',
            slug: 'hello',
          },
        ],
        packageRoot,
      })
    ).rejects.toThrow(/fs/u);
  });

  test('rejects banned Node specifiers during resolve', async () => {
    await expect(
      buildWithPlugin("import fs from 'node:fs'; export default fs;\n")
    ).rejects.toThrow(/node:fs/u);
  });

  test('rejects functhis/sdk/next during resolve', async () => {
    await expect(
      buildWithPlugin(
        "import { createHandler } from 'functhis/sdk/next';\nexport default createHandler({ functions: {} });\n"
      )
    ).rejects.toThrow(/Next.js app routes only/u);
  });

  test('rejects native addon paths', async () => {
    await expect(
      buildWithPlugin(
        "import addon from './native.node'; export default addon;\n"
      )
    ).rejects.toThrow(/Native addon/u);
  });

  test('rejects dynamic imports of non-relative specifiers', async () => {
    await expect(
      buildWithPlugin("export default async () => import('lodash');\n")
    ).rejects.toThrow(/dynamic import/u);
  });

  test('allows ordinary npm specifiers', async () => {
    const result = await esbuild.build({
      bundle: true,
      format: 'esm',
      logLevel: 'silent',
      platform: 'browser',
      plugins: [
        workerdCompatibilityPlugin(),
        {
          name: 'mark-npm-external',
          setup(build) {
            // esbuild onResolve filters are Go RE2 and reject the JS unicode flag.
            // eslint-disable-next-line require-unicode-regexp
            build.onResolve({ filter: /^[^./]/ }, (args) => {
              if (isBannedNodeSpecifier(args.path)) {
                return;
              }
              return { external: true, path: args.path };
            });
          },
        },
      ],
      stdin: {
        contents: "import { z } from 'zod';\nexport default z;\n",
        loader: 'ts',
      },
      write: false,
    });
    expect(result.errors).toEqual([]);
  });
});
