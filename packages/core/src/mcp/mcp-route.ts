import type { AuditableLogger } from 'evlog';

import type { McpAuthenticate } from './auth';
import { isMcpAuthResponse } from './auth';
import type { McpBindings } from './bindings';
import { runWithInboundRequestSignal } from './inbound-request-signal';
import { createFuncthisMcpHandler } from './mcp';
import type { McpHandlerDependencies } from './mcp';

export interface McpPostHandlerConfig {
  authenticate?: McpAuthenticate;
  cacheKey?: (bindings: McpBindings) => string;
  dependencies?: McpHandlerDependencies;
}

const userHandlers = new Map<
  string,
  ReturnType<typeof createFuncthisMcpHandler>
>();

const handlerCacheKey = (
  config: McpPostHandlerConfig,
  bindings: McpBindings,
  userId: string
): string => `${config.cacheKey?.(bindings) ?? ''}\0${userId}`;

const getUserMcpHandler = (
  config: McpPostHandlerConfig,
  bindings: McpBindings,
  userId: string
) => {
  const cacheKey = handlerCacheKey(config, bindings, userId);
  let handler = userHandlers.get(cacheKey);
  if (!handler) {
    handler = createFuncthisMcpHandler(bindings, userId, config.dependencies);
    userHandlers.set(cacheKey, handler);
  }
  return handler;
};

const mcpPostAuthRequired = (): Response =>
  Response.json(
    {
      error: 'authentication_required',
      error_description: 'MCP authenticate hook is not configured',
    },
    { status: 501 }
  );

export const createMcpPostHandler =
  (config: McpPostHandlerConfig = {}) =>
  (
    request: Request,
    bindings: McpBindings,
    log?: AuditableLogger
  ): Promise<Response> => {
    const { authenticate } = config;
    if (!authenticate) {
      return Promise.resolve(mcpPostAuthRequired());
    }
    return runWithInboundRequestSignal(request.signal, async () => {
      const authResult = await authenticate(request, bindings, log);
      if (isMcpAuthResponse(authResult)) {
        return authResult;
      }
      return getUserMcpHandler(config, bindings, authResult.userId).fetch(
        request
      );
    });
  };
