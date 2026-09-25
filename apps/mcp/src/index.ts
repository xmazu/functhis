import './ensure-zod-init';
import { handleProtectedMcpPost } from './mcp-route';
import { oauthProtectedResourceMetadata } from './prm';

const WELL_KNOWN_OAUTH_PROTECTED_RESOURCE =
  '/.well-known/oauth-protected-resource';

const methodNotAllowed = (): Response =>
  new Response('Method Not Allowed', {
    headers: { Allow: 'POST' },
    status: 405,
  });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Promise.resolve(new Response('ok'));
    }

    if (url.pathname === WELL_KNOWN_OAUTH_PROTECTED_RESOURCE) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return Promise.resolve(methodNotAllowed());
      }
      return Promise.resolve(oauthProtectedResourceMetadata(env));
    }

    if (url.pathname === '/mcp') {
      if (request.method !== 'POST') {
        return Promise.resolve(methodNotAllowed());
      }

      return handleProtectedMcpPost(request, env);
    }

    return Promise.resolve(new Response('Not Found', { status: 404 }));
  },
};
