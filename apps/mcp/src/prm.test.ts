import { describe, expect, it } from 'bun:test';

import { oauthProtectedResourceMetadata } from './prm';
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
});
