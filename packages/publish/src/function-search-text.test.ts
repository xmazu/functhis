import { describe, expect, test } from 'bun:test';

import { EMBEDDING_DIMENSIONS } from '@functhis/db/schema/vector';

import {
  buildFunctionSearchText,
  embedSearchQuery,
  embedTexts,
} from './function-search-text';

describe('buildFunctionSearchText', () => {
  test('includes slug, description, examples, and schema field names', () => {
    const text = buildFunctionSearchText({
      contract: {
        description: 'Merge a pull request.',
        examples: ['await merge({ prNumber: 1 })'],
        inputSchema: {
          properties: {
            mergeMethod: { description: 'How to merge', type: 'string' },
          },
          type: 'object',
        },
        outputSchema: {
          properties: { merged: { type: 'boolean' } },
          type: 'object',
        },
      },
      slug: 'merge-pr',
    });
    expect(text).toContain('merge-pr');
    expect(text).toContain('Merge a pull request.');
    expect(text).toContain('await merge({ prNumber: 1 })');
    expect(text).toContain('mergeMethod');
    expect(text).toContain('How to merge');
    expect(text).toContain('merged');
  });

  test('skips empty examples and non-object schemas', () => {
    const text = buildFunctionSearchText({
      contract: {
        description: '  ',
        examples: ['', 1, ' keep '],
        inputSchema: 'not-an-object',
      },
      slug: 'noop',
    });
    expect(text).toBe('noop\nkeep');
  });
});

describe('embedTexts', () => {
  test('returns an empty list for no texts', async () => {
    await expect(
      embedTexts({ run: () => Promise.reject(new Error('unused')) }, [])
    ).resolves.toEqual([]);
  });

  test('maps array embeddings and prefixes query text', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    let received: { model: string; text: string[] } | undefined;
    const texts = await embedTexts(
      {
        run: (model, input) => {
          received = { model, text: input.text };
          return Promise.resolve({ data: [vector] });
        },
      },
      ['hello'],
      { query: true }
    );
    expect(texts).toEqual([vector]);
    expect(received?.text[0]).toContain('hello');
    expect(received?.text[0]).not.toBe('hello');
  });

  test('maps a single Float32Array when the length is one embedding', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);
    const texts = await embedTexts(
      {
        run: () => Promise.resolve({ data: Float32Array.from(vector) }),
      },
      ['hello']
    );
    expect(texts).not.toBeNull();
    expect(texts?.[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(texts?.[0]?.every((value) => value === 1)).toBe(true);
  });

  test('slices a packed Float32Array for multiple texts', async () => {
    const first = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);
    const second = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 2);
    const texts = await embedTexts(
      {
        run: () =>
          Promise.resolve({ data: Float32Array.from([...first, ...second]) }),
      },
      ['a', 'b']
    );
    expect(texts).not.toBeNull();
    expect(texts?.[0]?.every((value) => value === 1)).toBe(true);
    expect(texts?.[1]?.every((value) => value === 2)).toBe(true);
  });

  test('returns null when embeddings are missing or the runner throws', async () => {
    await expect(
      embedTexts({ run: () => Promise.resolve({}) }, ['hello'])
    ).resolves.toBeNull();
    await expect(
      embedTexts({ run: () => Promise.reject(new Error('offline')) }, ['hello'])
    ).resolves.toBeNull();
  });
});

describe('embedSearchQuery', () => {
  test('returns the first query embedding', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);
    const result = await embedSearchQuery(
      {
        run: () => Promise.resolve({ data: [vector] }),
      },
      'find me'
    );
    expect(result).toEqual(vector);
  });
});
