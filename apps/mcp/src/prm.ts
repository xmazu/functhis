import type { McpWellKnownRoute } from '@functhis/core/mcp';
import { normalizeOAuthResourceIdentifier } from '@functhis/platform';

import { authIssuerFromConsoleUrl } from './auth-urls';
import type { FuncthisMcpBindings } from './functhis-bindings';

const MCP_ENDPOINT_PATH = '/mcp';

export const oauthProtectedResourceMetadataPaths = (): readonly string[] => [
  '/.well-known/oauth-protected-resource',
  `/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`,
];

export const oauthProtectedResourceMetadataUrl = (
  bindings: FuncthisMcpBindings
): string => {
  const origin = bindings.MCP_RESOURCE.replace(/\/$/u, '');
  return `${origin}/.well-known/oauth-protected-resource${MCP_ENDPOINT_PATH}`;
};

export const oauthProtectedResourceMetadata = (
  bindings: FuncthisMcpBindings
): Response =>
  Response.json({
    authorization_servers: [authIssuerFromConsoleUrl(bindings.CONSOLE_URL)],
    bearer_methods_supported: ['header'],
    resource: normalizeOAuthResourceIdentifier(bindings.MCP_RESOURCE),
  });

export const functhisOAuthProtectedResourceWellKnown: McpWellKnownRoute = {
  handle: (_request, bindings) =>
    oauthProtectedResourceMetadata(bindings as FuncthisMcpBindings),
  paths: oauthProtectedResourceMetadataPaths,
};
