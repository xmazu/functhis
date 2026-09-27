import { normalizeOAuthResourceIdentifier } from '@functhis/publish/oauth-resource';

import { authIssuerFromConsoleUrl } from './auth-urls';

const MCP_ENDPOINT_PATH = '/mcp';

export const oauthProtectedResourceMetadataPaths = (): readonly string[] => [
  '/.well-known/oauth-protected-resource',
  `/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`,
];

export const oauthProtectedResourceMetadataUrl = (env: Env): string => {
  const origin = env.MCP_RESOURCE.replace(/\/$/u, '');
  return `${origin}/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`;
};

export const oauthProtectedResourceMetadata = (env: Env): Response =>
  Response.json({
    authorization_servers: [authIssuerFromConsoleUrl(env.CONSOLE_URL)],
    bearer_methods_supported: ['header'],
    resource: normalizeOAuthResourceIdentifier(env.MCP_RESOURCE),
  });
