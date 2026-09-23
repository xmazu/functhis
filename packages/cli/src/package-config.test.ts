import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  loadPackageIdentity,
  packageSlugFromNpmName,
  writeFuncthisPackageFields,
} from './package-config';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('packageSlugFromNpmName', () => {
  test('strips the npm scope', () => {
    expect(packageSlugFromNpmName('@neroli/tools')).toBe('tools');
    expect(packageSlugFromNpmName('tools')).toBe('tools');
  });
});

describe('loadPackageIdentity', () => {
  test('reads the nearest package.json functhis field', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-pkg-'));
    roots.push(root);
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        functhis: { root: 'src', scope: 'neroli' },
        name: '@neroli/tools',
      }),
      'utf-8'
    );
    const nested = path.join(root, 'src', 'support');
    const identity = await loadPackageIdentity(nested);
    expect(identity?.packageRoot).toBe(root);
    expect(identity?.functhis).toEqual({
      name: undefined,
      root: 'src',
      scope: 'neroli',
    });
    expect(identity?.isWorkspaceRoot).toBe(false);
    expect(identity?.name).toBe('@neroli/tools');
  });

  test('returns null when package.json is not an object', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-pkg-array-'));
    roots.push(root);
    await writeFile(path.join(root, 'package.json'), '[]', 'utf-8');
    expect(await loadPackageIdentity(root)).toBeNull();
  });

  test('ignores non-string functhis fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-pkg-types-'));
    roots.push(root);
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        functhis: { name: 1, root: true, scope: { handle: 'x' } },
        name: 'tools',
        workspaces: { packages: ['apps/*'] },
      }),
      'utf-8'
    );
    const identity = await loadPackageIdentity(root);
    expect(identity?.functhis).toEqual({});
    expect(identity?.isWorkspaceRoot).toBe(true);
  });

  test('rejects writing when package.json is not an object', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-pkg-write-bad-'));
    roots.push(root);
    const packageJsonPath = path.join(root, 'package.json');
    await writeFile(packageJsonPath, '[]', 'utf-8');
    await expect(
      writeFuncthisPackageFields(packageJsonPath, { name: 'tools' })
    ).rejects.toThrow(/not an object/u);
  });

  test('writes missing functhis fields back to package.json', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-pkg-write-'));
    roots.push(root);
    const packageJsonPath = path.join(root, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify({ name: 'tools' }, null, 2),
      'utf-8'
    );
    await writeFuncthisPackageFields(packageJsonPath, {
      name: 'tools',
      root: 'src',
      scope: 'neroli',
    });
    const identity = await loadPackageIdentity(root);
    expect(identity?.functhis).toEqual({
      name: 'tools',
      root: 'src',
      scope: 'neroli',
    });
  });
});
