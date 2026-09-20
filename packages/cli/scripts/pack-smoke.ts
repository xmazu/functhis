import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const { prepareNpmManifest } = await import('./prepare-npm-manifest.ts');
const { restore } = await prepareNpmManifest();

const packageJson = await Bun.file(
  path.join(packageRoot, 'package.json')
).json();
const version = packageJson.version as string;

const smokeRoot = await mkdtemp(path.join(tmpdir(), 'functhis-pack-smoke-'));

try {
  const pack = spawnSync('npm', ['pack', '--pack-destination', smokeRoot], {
    cwd: packageRoot,
    encoding: 'utf-8',
  });
  if (pack.status !== 0) {
    console.error(pack.stderr || pack.stdout);
    process.exit(pack.status ?? 1);
  }

  const tarball = path.join(smokeRoot, `functhis-${version}.tgz`);
  const installPrefix = path.join(smokeRoot, 'install');

  const install = spawnSync(
    'npm',
    ['install', '--prefix', installPrefix, tarball],
    { encoding: 'utf-8' }
  );
  if (install.status !== 0) {
    console.error(install.stderr || install.stdout);
    process.exit(install.status ?? 1);
  }

  const binPath = path.join(installPrefix, 'node_modules', '.bin', 'functhis');

  const runBin = (args: string[]): void => {
    const result = spawnSync(binPath, args, { encoding: 'utf-8' });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
    if (!result.stdout.includes('functhis — deploy TypeScript functions')) {
      console.error('pack smoke: expected usage banner in stdout');
      process.exit(1);
    }
  };

  runBin([]);

  const npx = spawnSync(
    'npx',
    ['--yes', '--prefix', installPrefix, 'functhis'],
    { encoding: 'utf-8' }
  );
  if (npx.status !== 0) {
    console.error(npx.stderr || npx.stdout);
    process.exit(npx.status ?? 1);
  }

  console.log('pack smoke: ok');
} finally {
  await restore();
  await rm(smokeRoot, { force: true, recursive: true });
}
