import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as esbuild from 'esbuild';

import {
  createBootstrapSource,
  sha256Hex,
  stableBundlePayload,
} from './bundle';
import type { DiscoveredFunction } from './discover';

export interface WorkerLoaderBundle {
  bundleHash: string;
  mainModule: string;
  modules: Record<string, string>;
}

export const buildWorkerBundle = async (input: {
  files: Record<string, string>;
  functions: DiscoveredFunction[];
}): Promise<WorkerLoaderBundle> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bundle-'));

  try {
    await Promise.all(
      Object.entries(input.files).map(async ([filePath, content]) => {
        const target = path.join(tempDir, filePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, 'utf-8');
      })
    );

    const bootstrapPath = path.join(tempDir, '__functhis_bootstrap.ts');
    await writeFile(
      bootstrapPath,
      createBootstrapSource(input.functions),
      'utf-8'
    );

    const outPath = path.join(tempDir, 'out.js');
    await esbuild.build({
      absWorkingDir: tempDir,
      bundle: true,
      entryPoints: [bootstrapPath],
      format: 'esm',
      outfile: outPath,
      platform: 'browser',
      target: 'es2022',
      write: true,
    });

    const code = await readFile(outPath, 'utf-8');
    const mainModule = 'out.js';
    const bundle = { mainModule, modules: { [mainModule]: code } };
    const bundleHash = await sha256Hex(stableBundlePayload(bundle));
    return { ...bundle, bundleHash };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};
