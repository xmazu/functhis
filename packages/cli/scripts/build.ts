import { spawnSync } from 'node:child_process';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const distRoot = path.join(packageRoot, 'dist');
const sdkDistRoot = path.join(distRoot, 'sdk');

const runBuild = async (options: {
  entrypoints: string[];
  outdir: string;
  target: 'browser' | 'node';
}): Promise<void> => {
  const result = await Bun.build({
    entrypoints: options.entrypoints.map((entry) =>
      path.join(packageRoot, entry)
    ),
    external:
      options.target === 'node' ? ['esbuild', 'ts-morph', 'typescript'] : [],
    format: 'esm',
    outdir: options.outdir,
    packages: options.target === 'node' ? 'bundle' : undefined,
    target: options.target,
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
};

await runBuild({
  entrypoints: ['src/cli.ts'],
  outdir: distRoot,
  target: 'node',
});

await runBuild({
  entrypoints: ['sdk/next.ts'],
  outdir: sdkDistRoot,
  target: 'node',
});

await runBuild({
  entrypoints: ['sdk/client.ts'],
  outdir: sdkDistRoot,
  target: 'browser',
});

const emitRuntimeTypes = spawnSync(
  'bun',
  ['x', 'tsc', '-p', 'tsconfig.runtime.json'],
  { cwd: packageRoot, stdio: 'inherit' }
);

if (emitRuntimeTypes.status !== 0) {
  process.exit(emitRuntimeTypes.status ?? 1);
}

const copyTypes = spawnSync(
  process.execPath,
  [path.join(packageRoot, 'scripts/copy-author-types.ts')],
  { cwd: packageRoot, stdio: 'inherit' }
);

if (copyTypes.status !== 0) {
  process.exit(copyTypes.status ?? 1);
}

const assert = spawnSync(
  process.execPath,
  [path.join(packageRoot, 'scripts/assert-publish-bundle.ts')],
  { cwd: packageRoot, stdio: 'inherit' }
);

if (assert.status !== 0) {
  process.exit(assert.status ?? 1);
}
