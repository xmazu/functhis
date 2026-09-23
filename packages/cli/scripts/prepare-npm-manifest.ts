import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const pkgPath = path.join(packageRoot, 'package.json');
const rootPkgPath = path.join(packageRoot, '../../package.json');

export const prepareNpmManifest = async (): Promise<{
  restore: () => Promise<void>;
}> => {
  const original = await readFile(pkgPath, 'utf-8');
  const rootPkg = JSON.parse(await readFile(rootPkgPath, 'utf-8')) as {
    workspaces?: { catalog?: Record<string, string> };
  };
  const catalog = rootPkg.workspaces?.catalog ?? {};
  const pkg = JSON.parse(original) as {
    dependencies?: Record<string, string>;
  };

  if (pkg.dependencies) {
    delete pkg.dependencies['@functhis/publish'];
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      if (version === 'catalog:') {
        const resolved = catalog[name];
        if (!resolved) {
          throw new Error(`Missing catalog entry for dependency "${name}"`);
        }
        pkg.dependencies[name] = resolved;
      }
    }
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  return {
    restore: async () => {
      await writeFile(pkgPath, original);
    },
  };
};

if (import.meta.main) {
  await prepareNpmManifest();
}
