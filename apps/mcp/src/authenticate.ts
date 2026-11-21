import { parseBearerToken } from '@functhis/auth/publish-token';
import type { McpAuthenticate, McpBindings } from '@functhis/core';
import { asHotKvBinding } from '@functhis/core/publish/hot-kv-binding';
import { verifyAccessTokenWithHotJwks } from '@functhis/core/publish/jwks-hot';
import { oauthResourceIdentifierVariants } from '@functhis/core/publish/oauth-resource';
import type { AuditableLogger } from 'evlog';
import type { JWTPayload } from 'jose';

import {
  authIssuerFromConsoleUrl,
  authJwksUrlFromConsoleUrl,
} from './auth-urls';
import type { FuncthisMcpBindings } from './functhis-bindings';
import { oauthProtectedResourceMetadataUrl } from './prm';

export type { FuncthisMcpBindings } from './functhis-bindings';

export const functhisMcpCacheKey = (bindings: McpBindings): string => {
  const b = bindings as FuncthisMcpBindings;
  return `${b.CONSOLE_URL}\0${b.MCP_RESOURCE}`;
};

const userIdFromAccessToken = (claims: JWTPayload): string | null =>
  typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;

const mcpUnauthorizedResponse = (
  bindings: FuncthisMcpBindings,
  errorDescription: string
): Response => {
  const metadataUrl = oauthProtectedResourceMetadataUrl(bindings);
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

export const authenticateFuncthisMcp: McpAuthenticate = async (
  request: Request,
  bindings: McpBindings,
  log?: AuditableLogger
) => {
  const functhisBindings = bindings as FuncthisMcpBindings;
  const token = parseBearerToken(request);
  if (!token) {
    log?.set({ auth: { ok: false, reason: 'missing_bearer' } });
    return mcpUnauthorizedResponse(functhisBindings, 'Missing bearer token');
  }

  const issuer = authIssuerFromConsoleUrl(functhisBindings.CONSOLE_URL);
  const jwksUrl = authJwksUrlFromConsoleUrl(functhisBindings.CONSOLE_URL);
  const hot = asHotKvBinding(functhisBindings.HOT);

  try {
    const claims = await verifyAccessTokenWithHotJwks({
      audience: oauthResourceIdentifierVariants(functhisBindings.MCP_RESOURCE),
      hot,
      issuer,
      jwksUrl,
      token,
    });
    const userId = userIdFromAccessToken(claims);
    if (!userId) {
      log?.set({ auth: { ok: false, reason: 'missing_subject' } });
      return mcpUnauthorizedResponse(
        functhisBindings,
        'Access token is missing subject'
      );
    }
    log?.set({ auth: { ok: true }, user: { id: userId } });
    return { userId };
  } catch {
    log?.set({ auth: { ok: false, reason: 'token_verification_failed' } });
    return mcpUnauthorizedResponse(
      functhisBindings,
      'Access token verification failed'
    );
  }
};
