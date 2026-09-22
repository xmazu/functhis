import { describe, expect, test } from 'bun:test';

import { buildFunctionSearchText } from './function-search-text';

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
});
