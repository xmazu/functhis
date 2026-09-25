import { parseBearerToken } from '@functhis/auth/publish-token';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { verifyAccessTokenWithHotJwks } from '@functhis/publish/jwks-hot';
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
): ((request: Request) => Promise<Response>) => {
  const issuer = authIssuerFromConsoleUrl(env.CONSOLE_URL);
  const jwksUrl = authJwksUrlFromConsoleUrl(env.CONSOLE_URL);
  const hot = asHotKvBinding(env.HOT);

  return async (request: Request): Promise<Response> => {
    const token = parseBearerToken(request);
    if (!token) {
      return Response.json(
        {
          error: 'invalid_token',
          error_description: 'Missing bearer token',
        },
        { status: 401 }
      );
    }

    try {
      const claims = await verifyAccessTokenWithHotJwks({
        audience: env.MCP_RESOURCE,
        hot,
        issuer,
        jwksUrl,
        token,
      });
      const userId = userIdFromAccessToken(claims);
      if (!userId) {
        return Response.json(
          {
            error: 'invalid_token',
            error_description: 'Access token is missing subject',
          },
          { status: 401 }
        );
      }
      return handler(request, userId);
    } catch {
      return Response.json(
        {
          error: 'invalid_token',
          error_description: 'Access token verification failed',
        },
        { status: 401 }
      );
    }
  };
};
