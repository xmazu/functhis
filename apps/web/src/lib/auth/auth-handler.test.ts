import { describe, expect, test } from 'bun:test';

import { resolveAuthHandlerPath } from './auth-handler-path';

describe('resolveAuthHandlerPath', () => {
  test('prefixes issuer paths for Better Auth handler', () => {
    expect(resolveAuthHandlerPath('/oauth2/authorize')).toBe(
      '/api/auth/oauth2/authorize'
    );
    expect(
      resolveAuthHandlerPath('/.well-known/oauth-authorization-server')
    ).toBe('/api/auth/.well-known/oauth-authorization-server');
  });

  test('leaves /api/auth paths unchanged', () => {
    expect(resolveAuthHandlerPath('/api/auth/device')).toBe('/api/auth/device');
  });
});
