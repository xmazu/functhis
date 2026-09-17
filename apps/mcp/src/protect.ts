import { createMcpProtectedRequestHandler } from '@better-auth/mcp';
import type { JWTPayload } from 'jose';

export const authIssuerFromConsoleUrl = (consoleUrl: string): string =>
  new URL('/api/auth', consoleUrl).href;

export const authJwksUrlFromConsoleUrl = (consoleUrl: string): string =>
  new URL('/api/auth/jwks', consoleUrl).href;

export const userIdFromAccessToken = (claims: JWTPayload): string | null =>
  typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;

export const createProtectedMcpHandler = (
  env: Env,
  handler: (request: Request, userId: string) => Promise<Response>
): ((request: Request) => Promise<Response>) =>
  createMcpProtectedRequestHandler(
    {
      audience: env.MCP_RESOURCE,
      issuer: authIssuerFromConsoleUrl(env.CONSOLE_URL),
      jwksUrl: authJwksUrlFromConsoleUrl(env.CONSOLE_URL),
    },
    (request, accessTokenClaims) => {
      const userId = userIdFromAccessToken(accessTokenClaims);
      if (!userId) {
        return Promise.resolve(
          Response.json(
            {
              error: 'invalid_token',
              error_description: 'Access token is missing subject',
            },
            { status: 401 }
          )
        );
      }
      return handler(request, userId);
    }
  );
