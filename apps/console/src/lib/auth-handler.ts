import { createAuth } from '../services';
import { resolveAuthHandlerPath } from './auth-handler-path';

export { resolveAuthHandlerPath } from './auth-handler-path';

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
  return auth.handler(authRequest);
};
