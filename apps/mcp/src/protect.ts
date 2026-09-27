import { parseBearerToken } from '@functhis/auth/publish-token';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { verifyAccessTokenWithHotJwks } from '@functhis/publish/jwks-hot';
import { oauthResourceIdentifierVariants } from '@functhis/publish/oauth-resource';
import type { AuditableLogger } from 'evlog';
import type { JWTPayload } from 'jose';

import {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
} from './auth-urls';
import { oauthProtectedResourceMetadataUrl } from './prm';

const mcpUnauthorizedResponse = (
  env: Env,
  errorDescription: string
): Response => {
  const metadataUrl = oauthProtectedResourceMetadataUrl(env);
  return Response.json(
    {
      error: 'invalid_token',
      error_description: errorDescription,
    },
    {
      headers: {
        'WWW-Authenticate': `Bearer error="invalid_token", error_description="${errorDescription}", resource_metadata="${metadataUrl}"`,
      },
      status: 401,
    }
  );
};

export {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
} from './auth-urls';

export const userIdFromAccessToken = (claims: JWTPayload): string | null =>
  typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;

export const createProtectedMcpHandler = (
  env: Env,
  handler: (request: Request, userId: string) => Promise<Response>
): ((request: Request, log?: AuditableLogger) => Promise<Response>) => {
  const issuer = authIssuerFromConsoleUrl(env.CONSOLE_URL);
  const jwksUrl = authJwksUrlFromConsoleUrl(env.CONSOLE_URL);
  const hot = asHotKvBinding(env.HOT);

  return async (request: Request, log?: AuditableLogger): Promise<Response> => {
    const token = parseBearerToken(request);
    if (!token) {
      log?.set({ auth: { ok: false, reason: 'missing_bearer' } });
      return mcpUnauthorizedResponse(env, 'Missing bearer token');
    }

    try {
      const claims = await verifyAccessTokenWithHotJwks({
        audience: oauthResourceIdentifierVariants(env.MCP_RESOURCE),
        hot,
        issuer,
        jwksUrl,
        token,
      });
      const userId = userIdFromAccessToken(claims);
      if (!userId) {
        log?.set({ auth: { ok: false, reason: 'missing_subject' } });
        return mcpUnauthorizedResponse(env, 'Access token is missing subject');
      }
      log?.set({ auth: { ok: true }, user: { id: userId } });
      return handler(request, userId);
    } catch {
      log?.set({ auth: { ok: false, reason: 'token_verification_failed' } });
      return mcpUnauthorizedResponse(env, 'Access token verification failed');
    }
  };
};
