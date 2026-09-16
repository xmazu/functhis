import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { discoverProject } from './discover';

const tempRoots: string[] = [];

const makeProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'functhis-discover-'));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('discoverProject', () => {
  test('finds default exports in project root', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'hello.ts'),
      'export default async () => ({ ok: true });\n',
      'utf-8'
    );

    const { functions, files } = await discoverProject(root);
    expect(Object.keys(files)).toEqual(['hello.ts']);
    expect(functions.map((fn) => fn.slug)).toEqual(['hello']);
  });

  test('prefers functions/ directory when present', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'ignored.ts'),
      'export default async () => ({});\n',
      'utf-8'
    );
    await mkdir(path.join(root, 'functions'), { recursive: true });
    await writeFile(
      path.join(root, 'functions', 'api.ts'),
      'export default async () => ({});\n',
      'utf-8'
    );

    const { functions, files } = await discoverProject(root);
    expect(Object.keys(files)).toEqual(['functions/api.ts']);
    expect(functions.map((fn) => fn.slug)).toEqual(['api']);
  });
});
