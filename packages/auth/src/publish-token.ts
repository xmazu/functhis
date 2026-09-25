import type { Database } from '@functhis/db';
import { oauthAccessToken } from '@functhis/db/schema/auth';
import { CLI_CLIENT_ID, PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export { CLI_CLIENT_ID, PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';

export type PublishAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface PublishAuthOptions {
  /** OAuth issuer origin, e.g. `https://functhis.now`. */
  consoleUrl: string;
  /** When the issuer runs in-process (same Worker), avoid cross-fetch for cookies. */
  resolveSessionUserId?: (request: Request) => Promise<string | null>;
}

const unauthorized = (): PublishAuthResult => ({
  ok: false,
  response: new Response('Unauthorized', {
    headers: { 'WWW-Authenticate': 'Bearer' },
    status: 401,
  }),
});

const forbidden = (): PublishAuthResult => ({
  ok: false,
  response: new Response('Forbidden', { status: 403 }),
});

const jwksByConsoleUrl = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

const looksLikeJwt = (token: string): boolean => token.split('.').length === 3;

const validateOpaqueAccessToken = async (
  database: Database,
  token: string
): Promise<PublishAuthResult | null> => {
  const [row] = await database
    .select()
    .from(oauthAccessToken)
    .where(
      and(
        eq(oauthAccessToken.token, token),
        isNull(oauthAccessToken.revoked),
        gt(oauthAccessToken.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!row?.userId) {
    return null;
  }

  if (row.clientId !== CLI_CLIENT_ID) {
    return forbidden();
  }

  const resources = row.resources ?? [];
  if (!resources.includes(PUBLISH_API_RESOURCE)) {
    return forbidden();
  }

  return { ok: true, userId: row.userId };
};

const validateJwtAccessToken = async (
  token: string,
  options: PublishAuthOptions
): Promise<PublishAuthResult | null> => {
  if (!looksLikeJwt(token)) {
    return null;
  }

  let jwks = jwksByConsoleUrl.get(options.consoleUrl);
  if (!jwks) {
    const jwksUrl = new URL('/api/auth/jwks', options.consoleUrl);
    jwks = createRemoteJWKSet(jwksUrl);
    jwksByConsoleUrl.set(options.consoleUrl, jwks);
  }

  const issuer = new URL('/api/auth', options.consoleUrl).href;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      audience: PUBLISH_API_RESOURCE,
      issuer,
    });

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) {
      return unauthorized();
    }

    let clientId: string | null = null;
    if (typeof payload.client_id === 'string') {
      clientId = payload.client_id;
    } else if (typeof payload.azp === 'string') {
      clientId = payload.azp;
    }

    if (clientId !== CLI_CLIENT_ID) {
      return forbidden();
    }

    return { ok: true, userId };
  } catch {
    return unauthorized();
  }
};

export const parseBearerToken = (request: Request): string | null => {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export const validatePublishBearerToken = async (
  database: Database,
  request: Request,
  options: PublishAuthOptions
): Promise<PublishAuthResult> => {
  const token = parseBearerToken(request);
  if (!token) {
    return unauthorized();
  }

  const opaque = await validateOpaqueAccessToken(database, token);
  if (opaque) {
    return opaque;
  }

  const jwtResult = await validateJwtAccessToken(token, options);
  if (jwtResult) {
    return jwtResult;
  }

  return unauthorized();
};
