import { createAuth } from '../services';
import { resolveAuthHandlerPath } from './auth-handler-path';

export { resolveAuthHandlerPath } from './auth-handler-path';

export async function handleAuthRequest(request: Request): Promise<Response> {
  const auth = await createAuth();
  const url = new URL(request.url);
  url.pathname = resolveAuthHandlerPath(url.pathname);
  return auth.handler(new Request(url, request));
}
