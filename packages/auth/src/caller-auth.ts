import type { Database } from '@functhis/db';

import { parseBearerToken, validatePublishBearerToken } from './publish-token';
import type { PublishAuthOptions } from './publish-token';

export type CallerAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

const unauthorized = (): CallerAuthResult => ({
  ok: false,
  response: new Response('Unauthorized', {
    headers: { 'WWW-Authenticate': 'Bearer' },
    status: 401,
  }),
});

interface SessionPayload {
  session?: { userId?: string };
  user?: { id?: string };
}

export const resolveSessionUserId = async (
  request: Request,
  options: PublishAuthOptions
): Promise<string | null> => {
  const cookie = request.headers.get('Cookie');
  if (!cookie) {
    return null;
  }

  const sessionUrl = new URL('/api/auth/get-session', options.consoleUrl);
  const response = await fetch(sessionUrl, {
    headers: { Cookie: cookie },
  });

  if (!response.ok) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = (await response.json()) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.user?.id === 'string' && payload.user.id.length > 0) {
    return payload.user.id;
  }

  if (
    typeof payload.session?.userId === 'string' &&
    payload.session.userId.length > 0
  ) {
    return payload.session.userId;
  }

  return null;
};

export const resolveCallerUserId = async (
  database: Database,
  request: Request,
  options: PublishAuthOptions
): Promise<CallerAuthResult> => {
  const bearer = parseBearerToken(request);
  if (bearer) {
    const deployAuth = await validatePublishBearerToken(
      database,
      request,
      options
    );
    if (deployAuth.ok) {
      return deployAuth;
    }
    if (deployAuth.response.status !== 401) {
      return deployAuth;
    }
  }

  const sessionUserId = await resolveSessionUserId(request, options);
  if (sessionUserId) {
    return { ok: true, userId: sessionUserId };
  }

  return unauthorized();
};
