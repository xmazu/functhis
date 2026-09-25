import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.join(import.meta.dirname, '..');
const authorTypesPath = path.join(packageRoot, 'author-types/index.d.ts');
const runtimePath = path.join(packageRoot, '../runtime/src/isolate/runtime.ts');

describe('author-types', () => {
  test('declares functhis:runtime with context and secret', async () => {
    const dts = await readFile(authorTypesPath, 'utf-8');
    expect(dts).toContain("declare module 'functhis:runtime'");
    expect(dts).toContain(
      'export function context(): FuncthisInvocationContext'
    );
    expect(dts).toContain('export function secret(name: string): string');
  });

  test('FuncthisInvocationContext fields match runtime kernel', async () => {
    const [dts, runtime] = await Promise.all([
      readFile(authorTypesPath, 'utf-8'),
      readFile(runtimePath, 'utf-8'),
    ]);
    const interfaceMatch = runtime.match(
      /export interface FuncthisInvocationContext \{(?<body>[^}]+)\}/su
    );
    expect(interfaceMatch?.groups?.body).toBeDefined();
    const body = interfaceMatch?.groups?.body ?? '';
    const runtimeFields = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'));
    for (const field of runtimeFields) {
      expect(dts).toContain(field.replace(/;$/u, ''));
    }
  });
});
