import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Project } from 'ts-morph';

import { buildFunctionContract, typeToJsonSchema } from './discover-contract';

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
  return typeToJsonSchema(type);
};

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
      additionalProperties: false,
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
      additionalProperties: false,
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

  test('maps string | number input to anyOf', () => {
    const contract = contractFor(
      'export default function fn(input: string | number) {\n  return input;\n}\n'
    );
    expect(contract?.inputSchema).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    });
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

describe('typeToJsonSchema', () => {
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
      additionalProperties: false,
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

  test('maps unknown input to an empty schema', () => {
    expect(schemaForTypeSnippet('unknown')).toEqual({});
  });

  test('maps string literal unions to enum', () => {
    expect(schemaForTypeSnippet("'a' | 'b'")).toEqual({
      enum: ['a', 'b'],
      type: 'string',
    });
  });
});

describe('rich contract extraction', () => {
  test('keeps full JSDoc body in description', () => {
    const contract = contractFor(
      '/** Line one.\n\nLine two stays. */\nexport default async () => ({});\n'
    );
    expect(contract?.description).toBe('Line one.\n\nLine two stays.');
  });

  test('collects @example tags', () => {
    const contract = contractFor(
      '/**\n * Demo.\n * @example\n * await fn({ id: 1 })\n */\nexport default async () => ({});\n'
    );
    expect(contract?.examples).toEqual(['await fn({ id: 1 })']);
  });

  test('applies @param only for fields present in the type', () => {
    const contract = contractFor(
      '/**\n * @param input.text Body text\n * @param input.ghost Ignored\n */\nexport default function fn(input: { text: string }) {\n  return input;\n}\n'
    );
    const properties = contract?.inputSchema?.properties as Record<
      string,
      { description?: string }
    >;
    expect(properties?.text?.description).toBe('Body text');
    expect(properties?.ghost).toBeUndefined();
  });

  test('applies @param name matching top-level input fields', () => {
    const contract = contractFor(
      '/** @param text Body text */\nexport default function fn(input: { text: string }) {\n  return input;\n}\n'
    );
    const properties = contract?.inputSchema?.properties as Record<
      string,
      { description?: string }
    >;
    expect(properties?.text?.description).toBe('Body text');
  });

  test('extracts outputSchema from Promise return type', () => {
    const contract = contractFor(
      'export default async function fn(): Promise<{ ok: boolean }> {\n  return { ok: true };\n}\n'
    );
    expect(contract?.outputSchema).toEqual({
      additionalProperties: false,
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      type: 'object',
    });
  });

  test('maps Record<string, unknown> input to open object', () => {
    const contract = contractFor(
      'export default async function fn(input: Record<string, unknown> = {}) {\n  return input;\n}\n'
    );
    expect(contract?.inputSchema).toEqual({
      additionalProperties: true,
      type: 'object',
    });
  });

  test('maps union properties to anyOf and keeps siblings', () => {
    const contract = contractFor(
      'export default function fn(input: { id: string; value: string | number }) {\n  return input;\n}\n'
    );
    expect(contract?.inputSchema).toEqual({
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      required: ['id', 'value'],
      type: 'object',
    });
  });
});
