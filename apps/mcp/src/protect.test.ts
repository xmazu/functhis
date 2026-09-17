import { describe, expect, test } from 'bun:test';

import {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
} from '../src/protect';

describe('MCP auth URLs', () => {
  test('derives issuer and JWKS from console URL', () => {
    expect(authIssuerFromConsoleUrl('http://localhost:3002')).toBe(
      'http://localhost:3002/api/auth'
    );
    expect(authJwksUrlFromConsoleUrl('http://localhost:3002')).toBe(
      'http://localhost:3002/api/auth/jwks'
    );
  });
});
