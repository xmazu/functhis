import { parseError } from 'evlog';

import { createAuth } from '#/services';

import { resolveAuthHandlerPath } from './auth-handler-path';

export { resolveAuthHandlerPath } from './auth-handler-path';

const MAX_AUTH_ERROR_BODY_LOG_CHARS = 200;

const truncateForAuthLog = (body: string): string =>
  body.length <= MAX_AUTH_ERROR_BODY_LOG_CHARS
    ? body
    : `${body.slice(0, MAX_AUTH_ERROR_BODY_LOG_CHARS)}…`;

const toAuthHandlerRequest = async (request: Request): Promise<Request> => {
  const url = new URL(request.url);
  url.pathname = resolveAuthHandlerPath(url.pathname);

  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Request(url, request);
  }

  const body = await request.arrayBuffer();
  return new Request(url, {
    body: body.byteLength > 0 ? body : undefined,
    headers: request.headers,
    method: request.method,
  });
};

export const handleAuthRequest = async (
  request: Request
): Promise<Response> => {
  const auth = await createAuth();
  const authRequest = await toAuthHandlerRequest(request);
  const response = await auth.handler(authRequest);

  if (!response.ok) {
    const path = new URL(request.url).pathname;
    const body = await response.clone().text();
    console.error(
      parseError(
        new Error(
          body.length > 0
            ? `Auth ${path} ${response.status}: ${truncateForAuthLog(body)}`
            : `Auth ${path} ${response.status}`
        )
      )
    );
  }

  return response;
};
