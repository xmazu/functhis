import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as esbuild from 'esbuild';

import {
  createBootstrapSource,
  sha256Hex,
  stableBundlePayload,
} from './bundle';
import type { DiscoveredFunction } from './discover';
import { runtimeExternalPlugin } from './runtime-external';
import {
  assertBundleHasNoBannedNodeImports,
  assertSourceHasNoBannedNodeImports,
  workerdCompatibilityPlugin,
} from './workerd-compat';

export interface WorkerLoaderBundle {
  bundleHash: string;
  mainModule: string;
  modules: Record<string, string>;
  sourceMap: string;
}

const collectNodeModulePaths = async (
  packageRoot: string
): Promise<string[]> => {
  const candidates: string[] = [];
  let directory = path.resolve(packageRoot);
  for (;;) {
    candidates.push(path.join(directory, 'node_modules'));
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  const existing = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await access(candidate);
        return candidate;
      } catch {
        return null;
      }
    })
  );

  return existing.filter(
    (candidate): candidate is string => candidate !== null
  );
};

export const buildWorkerBundle = async (input: {
  files: Record<string, string>;
  functions: DiscoveredFunction[];
  packageRoot: string;
}): Promise<WorkerLoaderBundle> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-bundle-'));
  const nodePaths = await collectNodeModulePaths(input.packageRoot);

  try {
    for (const content of Object.values(input.files)) {
      assertSourceHasNoBannedNodeImports(content);
    }
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

    const outPath = path.join(tempDir, 'bundle.mjs');
    await esbuild.build({
      absWorkingDir: tempDir,
      bundle: true,
      entryPoints: [bootstrapPath],
      format: 'esm',
      nodePaths: nodePaths.length > 0 ? nodePaths : undefined,
      outfile: outPath,
      platform: 'browser',
      plugins: [runtimeExternalPlugin(), workerdCompatibilityPlugin()],
      sourcemap: true,
      target: 'es2022',
      write: true,
    });

    const code = await readFile(outPath, 'utf-8');
    assertBundleHasNoBannedNodeImports(code);
    let sourceMap = '';
    try {
      sourceMap = await readFile(`${outPath}.map`, 'utf-8');
    } catch {
      sourceMap = '';
    }

    const mainModule = 'bundle.mjs';
    const bundle = { mainModule, modules: { [mainModule]: code } };
    const bundleHash = await sha256Hex(stableBundlePayload(bundle));
    return { ...bundle, bundleHash, sourceMap };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};
