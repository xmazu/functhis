import { describe, expect, it } from 'bun:test';

import {
  oauthProtectedResourceMetadata,
  oauthProtectedResourceMetadataPaths,
  oauthProtectedResourceMetadataUrl,
} from './prm';
import { authIssuerFromConsoleUrl } from './protect';

describe('oauth protected resource metadata', () => {
  it('advertises the same issuer as MCP JWT validation', async () => {
    const env = {
      CONSOLE_URL: 'https://console.functhis.now',
      MCP_RESOURCE: 'https://mcp.functhis.now',
    } as Env;

    const response = oauthProtectedResourceMetadata(env);
    const body = (await response.json()) as {
      authorization_servers: string[];
      resource: string;
    };

    expect(body.resource).toBe(env.MCP_RESOURCE);
    expect(body.authorization_servers).toEqual([
      authIssuerFromConsoleUrl(env.CONSOLE_URL),
    ]);
  });

  it('advertises path-aware metadata for MCP clients (RFC 9728)', () => {
    const env = {
      CONSOLE_URL: 'http://localhost:3001',
      MCP_RESOURCE: 'http://localhost:3003',
    } as Env;

    expect(oauthProtectedResourceMetadataUrl(env)).toBe(
      'http://localhost:3003/.well-known/oauth-protected-resource/mcp'
    );
    expect(oauthProtectedResourceMetadataPaths()).toContain(
      '/.well-known/oauth-protected-resource/mcp'
    );
  });
});
