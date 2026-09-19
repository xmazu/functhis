import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Project } from 'ts-morph';

import {
  buildFunctionContract,
  firstParagraph,
  typeToInputSchema,
} from './discover-contract';

const contractFor = (
  content: string,
  slug = 'hello'
): ReturnType<typeof buildFunctionContract> =>
  buildFunctionContract({
    content,
    projectRoot: '/tmp',
    relativePath: `${slug}.ts`,
    slug,
  });

const schemaForTypeSnippet = (typeSnippet: string) => {
  const project = new Project({ compilerOptions: { strict: true } });
  const source = project.createSourceFile(
    'schema.ts',
    `type T = ${typeSnippet};\nconst x: T = null as never;\n`,
    { overwrite: true }
  );
  const alias = source.getTypeAlias('T');
  const type = alias?.getType();
  if (!type) {
    throw new Error('missing type');
  }
  return typeToInputSchema(type);
};

describe('firstParagraph', () => {
  test('falls back to slug when JSDoc is empty', () => {
    expect(firstParagraph(undefined, 'hello')).toBe('hello');
    expect(firstParagraph('   ', 'hello')).toBe('hello');
  });

  test('uses only the first paragraph of JSDoc', () => {
    expect(
      firstParagraph('Line one.\n\nLine two should not appear.', 'slug')
    ).toBe('Line one.');
  });
});

describe('buildFunctionContract', () => {
  test('returns null without default export', () => {
    expect(contractFor('export const x = 1;')).toBeNull();
  });

  test('accepts default export function declaration with JSDoc on export', () => {
    const contract = contractFor(
      '/** Summarize text. */\nexport default function summarize(input: { text: string }) {\n  return input;\n}\n'
    );
    expect(contract?.description).toBe('Summarize text.');
    expect(contract?.inputSchema).toEqual({
      properties: { text: { type: 'string' } },
      required: ['text'],
      type: 'object',
    });
  });

  test('accepts default export arrow function', () => {
    const contract = contractFor(
      'export default (input: { count: number }) => ({ count: input.count });\n'
    );
    expect(contract?.inputSchema).toEqual({
      properties: { count: { type: 'number' } },
      required: ['count'],
      type: 'object',
    });
  });

  test('ignores parameters not named input', () => {
    const contract = contractFor(
      'export default function fn(payload: { id: string }) {\n  return payload;\n}\n'
    );
    expect(contract?.inputSchema).toBeUndefined();
  });

  test('omits inputSchema for unsupported unions on input', () => {
    const contract = contractFor(
      'export default function fn(input: string | number) {\n  return input;\n}\n'
    );
    expect(contract?.inputSchema).toBeUndefined();
  });

  test('reads project tsconfig when present', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-contract-'));
    try {
      await writeFile(
        path.join(root, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true } }),
        'utf-8'
      );
      const contract = buildFunctionContract({
        content:
          'export default function fn(input: { name?: string }) { return input; }\n',
        projectRoot: root,
        relativePath: 'hello.ts',
        slug: 'hello',
      });
      expect(contract?.inputSchema?.properties).toEqual({
        name: { type: 'string' },
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe('typeToInputSchema', () => {
  test('maps string and number primitives', () => {
    expect(schemaForTypeSnippet('string')).toEqual({ type: 'string' });
    expect(schemaForTypeSnippet('number')).toEqual({ type: 'number' });
  });

  test('maps boolean fields on input objects', () => {
    const contract = buildFunctionContract({
      content:
        'export default function fn(input: { ok: boolean }) { return input; }\n',
      projectRoot: '/tmp',
      relativePath: 'flag.ts',
      slug: 'flag',
    });
    expect(contract?.inputSchema).toEqual({
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      type: 'object',
    });
  });

  test('maps string arrays', () => {
    expect(schemaForTypeSnippet('string[]')).toEqual({
      items: { type: 'string' },
      type: 'array',
    });
  });

  test('maps unknown input to open object', () => {
    expect(schemaForTypeSnippet('unknown')).toEqual({
      additionalProperties: true,
      type: 'object',
    });
  });
});
