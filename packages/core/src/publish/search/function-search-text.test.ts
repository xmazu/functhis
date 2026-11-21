import { describe, expect, test } from 'bun:test';

import { buildFunctionSearchText } from './function-search-text';

describe('buildFunctionSearchText', () => {
  test('includes slug, description, and schema paths', () => {
    const text = buildFunctionSearchText({
      contract: {
        description: 'Generates slides',
        inputSchema: {
          properties: {
            topic: { description: 'Talk topic', type: 'string' },
          },
          type: 'object',
        },
      },
      slug: 'generate-slides',
    });
    expect(text).toContain('generate-slides');
    expect(text).toContain('Generates slides');
    expect(text).toContain('topic');
    expect(text).toContain('Talk topic');
  });
});
