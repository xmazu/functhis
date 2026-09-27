import { describe, expect, test } from 'bun:test';

import {
  normalizeOAuthResourceIdentifier,
  oauthResourceIdentifierVariants,
} from './oauth-resource';

describe('normalizeOAuthResourceIdentifier', () => {
  test('strips trailing slash on origin-only MCP resources', () => {
    expect(normalizeOAuthResourceIdentifier('http://localhost:3003/')).toBe(
      'http://localhost:3003'
    );
    expect(normalizeOAuthResourceIdentifier('http://localhost:3003')).toBe(
      'http://localhost:3003'
    );
  });

  test('preserves path resources', () => {
    expect(
      normalizeOAuthResourceIdentifier('https://mcp.example.com/mcp')
    ).toBe('https://mcp.example.com/mcp');
  });
});

describe('oauthResourceIdentifierVariants', () => {
  test('includes slash and no-slash origin forms', () => {
    expect(oauthResourceIdentifierVariants('http://localhost:3003')).toEqual(
      expect.arrayContaining([
        'http://localhost:3003',
        'http://localhost:3003/',
      ])
    );
  });
});
