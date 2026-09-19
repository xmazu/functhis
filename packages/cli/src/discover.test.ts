import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { discoverProject, filesManifest } from './discover';

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

describe('filesManifest', () => {
  test('reports utf-8 byte length per path', () => {
    expect(filesManifest({ 'a.ts': 'hi', 'b.ts': '你好' })).toEqual([
      { bytes: 2, path: 'a.ts' },
      { bytes: 6, path: 'b.ts' },
    ]);
  });
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
    expect(functions[0]?.contract.description).toBe('hello');
    expect(functions[0]?.contract.inputSchema).toBeUndefined();
  });

  test('uses leading JSDoc as contract description when present', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'hello.ts'),
      '/** Greet someone by name. */\nexport default async () => ({ ok: true });\n',
      'utf-8'
    );

    const { functions } = await discoverProject(root);
    expect(functions[0]?.contract.description).toBe('Greet someone by name.');
  });

  test('extracts inputSchema from input parameter type', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'hello.ts'),
      'export default function fn(input: { name?: string }) {\n  return input;\n}\n',
      'utf-8'
    );

    const { functions } = await discoverProject(root);
    expect(functions[0]?.contract.inputSchema).toEqual({
      properties: { name: { type: 'string' } },
      required: [],
      type: 'object',
    });
  });

  test('omits inputSchema when default export has no input param', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'hello.ts'),
      'export default function fn() {\n  return {};\n}\n',
      'utf-8'
    );

    const { functions } = await discoverProject(root);
    expect(functions[0]?.contract.inputSchema).toBeUndefined();
  });

  test('skips files without default export', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'helpers.ts'),
      'export const helper = () => ({});\n',
      'utf-8'
    );

    await expect(discoverProject(root)).rejects.toThrow(/No functions found/u);
  });

  test('derives kebab-case slug from file name', async () => {
    const root = await makeProject();
    await writeFile(
      path.join(root, 'generatePresentation.ts'),
      'export default async () => ({});\n',
      'utf-8'
    );

    const { functions } = await discoverProject(root);
    expect(functions[0]?.slug).toBe('generate-presentation');
  });

  test('matches hello-world author contract', async () => {
    const projectRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    const { functions } = await discoverProject(projectRoot);
    expect(functions).toHaveLength(1);
    expect(functions[0]).toMatchObject({
      contract: {
        description: 'Greet someone by name.',
        inputSchema: {
          properties: { name: { type: 'string' } },
          required: [],
          type: 'object',
        },
      },
      exportName: 'default',
      path: 'hello.ts',
      slug: 'hello',
    });
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
