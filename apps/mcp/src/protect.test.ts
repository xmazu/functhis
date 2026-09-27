import { describe, expect, test } from 'bun:test';

import {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
  createProtectedMcpHandler,
} from '../src/protect';

describe('MCP auth URLs', () => {
  test('returns WWW-Authenticate with path-aware resource_metadata on 401', async () => {
    const env = {
      CONSOLE_URL: 'http://localhost:3001',
      HOT: {},
      MCP_RESOURCE: 'http://localhost:3003',
    } as Env;
    const handler = createProtectedMcpHandler(env, () =>
      Promise.resolve(new Response('ok'))
    );
    const response = await handler(new Request('http://localhost:3003/mcp'));
    expect(response.status).toBe(401);
    const authenticate = response.headers.get('WWW-Authenticate');
    expect(authenticate).toContain('resource_metadata=');
    expect(authenticate).toContain(
      'http://localhost:3003/.well-known/oauth-protected-resource/mcp'
    );
  });

  test('derives issuer and JWKS from console URL', () => {
    expect(authIssuerFromConsoleUrl('http://localhost:3002')).toBe(
      'http://localhost:3002/api/auth'
    );
    expect(authJwksUrlFromConsoleUrl('http://localhost:3002')).toBe(
      'http://localhost:3002/api/auth/jwks'
    );
  });
});
