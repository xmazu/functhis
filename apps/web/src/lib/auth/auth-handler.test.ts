import { describe, expect, test } from 'bun:test';

import {
  resolveAuthHandlerPath,
  rewriteOAuthDiscoveryRequest,
} from './auth-handler-path';

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

  test('rewrites issuer discovery URLs onto the registered routes', () => {
    const request = rewriteOAuthDiscoveryRequest(
      new Request(
        'http://localhost:3001/.well-known/oauth-authorization-server/api/auth'
      )
    );
    expect(new URL(request.url).pathname).toBe(
      '/.well-known/oauth-authorization-server'
    );
  });

  test('maps RFC 8414 issuer well-known URLs onto Better Auth', () => {
    expect(
      resolveAuthHandlerPath('/.well-known/oauth-authorization-server/api/auth')
    ).toBe('/api/auth/.well-known/oauth-authorization-server');
    expect(
      resolveAuthHandlerPath('/.well-known/openid-configuration/api/auth')
    ).toBe('/api/auth/.well-known/openid-configuration');
  });
});
