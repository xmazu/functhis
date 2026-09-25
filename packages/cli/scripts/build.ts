import { spawnSync } from 'node:child_process';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);

const result = await Bun.build({
  entrypoints: [path.join(packageRoot, 'src/cli.ts')],
  external: ['esbuild', 'ts-morph', 'typescript'],
  format: 'esm',
  outdir: path.join(packageRoot, 'dist'),
  packages: 'bundle',
  target: 'node',
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
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
