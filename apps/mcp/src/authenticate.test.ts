import { describe, expect, test } from 'bun:test';

import { createMcpPostHandler } from '@functhis/core/mcp';

import {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
} from './auth-urls';
import { authenticateFuncthisMcp } from './authenticate';
import type { FuncthisMcpBindings } from './authenticate';

describe('Functhis MCP authenticate', () => {
  test('returns WWW-Authenticate with path-aware resource_metadata on 401', async () => {
    const bindings = {
      CONSOLE_URL: 'http://localhost:3001',
      HOT: {
        delete: () => Promise.resolve(),
        get: () => Promise.resolve(null),
        put: () => Promise.resolve(),
      },
      MCP_RESOURCE: 'http://localhost:3003',
    } as FuncthisMcpBindings;
    const handlePost = createMcpPostHandler({
      authenticate: authenticateFuncthisMcp,
    });
    const response = await handlePost(
      new Request('http://localhost:3003/mcp', { method: 'POST' }),
      bindings
    );
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
