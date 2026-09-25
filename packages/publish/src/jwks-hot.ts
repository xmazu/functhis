import { createLocalJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import { HOT_JWKS_KEY } from './hot-keys';
import type { HotKvBinding } from './http-context';

type HotJwks = Parameters<typeof createLocalJWKSet>[0];

export const writeJwksHot = async (
  hot: HotKvBinding,
  jwks: unknown
): Promise<void> => {
  await hot.put(HOT_JWKS_KEY, JSON.stringify(jwks));
};

export const resolveJwksVerifier = async (
  hot: HotKvBinding,
  jwksUrl: string
): Promise<ReturnType<typeof createLocalJWKSet>> => {
  const cached = await hot.get(HOT_JWKS_KEY);
  if (cached) {
    try {
      return createLocalJWKSet(JSON.parse(cached) as HotJwks);
    } catch {
      // fall through to remote fetch
    }
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS (${response.status})`);
  }
  const jwks = (await response.json()) as HotJwks;
  await writeJwksHot(hot, jwks);
  return createLocalJWKSet(jwks);
};

export const verifyAccessTokenWithHotJwks = async (input: {
  audience: string;
  hot: HotKvBinding;
  issuer: string;
  jwksUrl: string;
  token: string;
}): Promise<JWTPayload> => {
  const jwks = await resolveJwksVerifier(input.hot, input.jwksUrl);
  const { payload } = await jwtVerify(input.token, jwks, {
    audience: input.audience,
    issuer: input.issuer,
  });
  return payload;
};
