import type { AuditableLogger } from 'evlog';

import type { McpBindings } from './bindings';
import type { McpPostHandlerConfig } from './mcp-route';
import { createMcpPostHandler } from './mcp-route';

export interface McpWellKnownRoute {
  paths: () => readonly string[];
  handle: (request: Request, bindings: McpBindings) => Response;
}

export type McpWorkerHandlerConfig = McpPostHandlerConfig & {
  wellKnown?: readonly McpWellKnownRoute[];
};

const methodNotAllowed = (): Response =>
  new Response('Method Not Allowed', {
    headers: { Allow: 'POST' },
    status: 405,
  });

export const createMcpWorkerHandler = (config: McpWorkerHandlerConfig = {}) => {
  const handleMcpPost = createMcpPostHandler(config);
  const wellKnown = config.wellKnown ?? [];

  return (
    request: Request,
    bindings: McpBindings,
    log: AuditableLogger
  ): Response | Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok');
    }

    for (const route of wellKnown) {
      if (!route.paths().includes(url.pathname)) {
        continue;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return methodNotAllowed();
      }
      return route.handle(request, bindings);
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
      return handleMcpPost(request, bindings, log);
    }

    return new Response('Not Found', { status: 404 });
  };
};
