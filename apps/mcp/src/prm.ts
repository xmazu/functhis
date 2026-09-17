import { authIssuerFromConsoleUrl } from './protect';

export const oauthProtectedResourceMetadata = (env: Env): Response =>
  Response.json({
    authorization_servers: [authIssuerFromConsoleUrl(env.CONSOLE_URL)],
    bearer_methods_supported: ['header'],
    resource: env.MCP_RESOURCE,
  });
