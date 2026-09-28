import { describe, expect, test } from 'bun:test';

import {
  buildEmbeddingInput,
  buildIntentPhrases,
  truncateEmbeddingInput,
} from './search-projection';

describe('buildIntentPhrases', () => {
  test('pairs description with required parameters', () => {
    expect(
      buildIntentPhrases({
        contract: {
          description: 'Find a user by email',
          inputSchema: {
            properties: {
              email: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['email'],
            type: 'object',
          },
        },
        slug: 'users/search',
      })
    ).toEqual(['Find a user by email email']);
  });

  test('falls back to slug and parameter names without description', () => {
    expect(
      buildIntentPhrases({
        contract: {
          inputSchema: {
            properties: { email: { type: 'string' } },
            type: 'object',
          },
        },
        slug: 'users/search',
      })
    ).toEqual(['users/search email']);
  });
});

describe('truncateEmbeddingInput', () => {
  test('keeps short text', () => {
    expect(truncateEmbeddingInput('hello')).toBe('hello');
  });

  test('cuts at max chars', () => {
    expect(truncateEmbeddingInput('abcdef', 3)).toBe('abc');
  });
});

describe('buildEmbeddingInput', () => {
  test('prefixes the capability id', () => {
    expect(
      buildEmbeddingInput({
        id: '@acme/crm/users/search',
        projectionText: 'Find a user by email',
      })
    ).toBe('@acme/crm/users/search\nFind a user by email');
  });
});
