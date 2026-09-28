import './ensure-zod-init';
import { createEvlogWorkerFetch } from '@functhis/config/evlog-workers';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { VectorizeEmbeddingIndex } from '@functhis/publish/vectorize-index';
import { reconcileSearchIndexDebt } from '@functhis/publish/vectorize-upsert';
import type { AuditableLogger } from 'evlog';

import { handleProtectedMcpPost } from './mcp-route';
import {
  oauthProtectedResourceMetadata,
  oauthProtectedResourceMetadataPaths,
} from './prm';

const methodNotAllowed = (): Response =>
  new Response('Method Not Allowed', {
    headers: { Allow: 'POST' },
    status: 405,
  });

const routeFetch = (
  request: Request,
  env: Env,
  _ctx: unknown,
  log: AuditableLogger
): Response | Promise<Response> => {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return new Response('ok');
  }

  if (oauthProtectedResourceMetadataPaths().includes(url.pathname)) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return methodNotAllowed();
    }
    return oauthProtectedResourceMetadata(env);
  }

  if (url.pathname === '/mcp') {
    if (request.method !== 'POST') {
      return methodNotAllowed();
    }

    log.set({
      mcp: {
        mcpMethod: request.headers.get('Mcp-Method') ?? undefined,
        protocolVersion:
          request.headers.get('MCP-Protocol-Version') ?? undefined,
      },
    });
    return handleProtectedMcpPost(request, env, log);
  }

  return new Response('Not Found', { status: 404 });
};

const instrumented = createEvlogWorkerFetch('functhis-mcp', routeFetch);

export default {
  fetch: instrumented.fetch,
  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): void {
    if (!env.CAPABILITY_VECTOR_INDEX) {
      return;
    }
    const hot = asHotKvBinding(env.HOT);
    const index = new VectorizeEmbeddingIndex(env.CAPABILITY_VECTOR_INDEX);
    ctx.waitUntil(reconcileSearchIndexDebt({ env, hot, index }));
  },
};
