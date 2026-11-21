import { describe, expect, it } from 'bun:test';

import { authIssuerFromConsoleUrl } from './auth-urls';
import type { FuncthisMcpBindings } from './authenticate';
import {
  oauthProtectedResourceMetadata,
  oauthProtectedResourceMetadataPaths,
  oauthProtectedResourceMetadataUrl,
} from './prm';

describe('oauth protected resource metadata', () => {
  it('advertises the same issuer as MCP JWT validation', async () => {
    const bindings = {
      CONSOLE_URL: 'https://console.functhis.now',
      MCP_RESOURCE: 'https://mcp.functhis.now',
    } as FuncthisMcpBindings;

    const response = oauthProtectedResourceMetadata(bindings);
    const body = (await response.json()) as {
      authorization_servers: string[];
      resource: string;
    };

    expect(body.resource).toBe(bindings.MCP_RESOURCE);
    expect(body.authorization_servers).toEqual([
      authIssuerFromConsoleUrl(bindings.CONSOLE_URL),
    ]);
  });

  it('advertises path-aware metadata for MCP clients (RFC 9728)', () => {
    const bindings = {
      CONSOLE_URL: 'http://localhost:3001',
      MCP_RESOURCE: 'http://localhost:3003',
    } as FuncthisMcpBindings;

    expect(oauthProtectedResourceMetadataUrl(bindings)).toBe(
      'http://localhost:3003/.well-known/oauth-protected-resource/mcp'
    );
    expect(oauthProtectedResourceMetadataPaths()).toContain(
      '/.well-known/oauth-protected-resource/mcp'
    );
  });
});
