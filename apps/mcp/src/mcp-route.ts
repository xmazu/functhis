import type { AuditableLogger } from 'evlog';

import { runWithInboundRequestSignal } from './inbound-request-signal';
import { createFuncthisMcpHandler } from './mcp';
import { createProtectedMcpHandler } from './protect';

const mcpEnvKey = (env: Env): string =>
  `${env.CONSOLE_URL}\0${env.MCP_RESOURCE}`;

type ProtectedMcpGate = (
  request: Request,
  log?: AuditableLogger
) => Promise<Response>;

let cachedProtectedGate:
  | {
      envKey: string;
      gate: ProtectedMcpGate;
    }
  | undefined;

const userHandlers = new Map<
  string,
  ReturnType<typeof createFuncthisMcpHandler>
>();

const getUserMcpHandler = (env: Env, userId: string) => {
  const cacheKey = `${mcpEnvKey(env)}\0${userId}`;
  let handler = userHandlers.get(cacheKey);
  if (!handler) {
    handler = createFuncthisMcpHandler(env, userId);
    userHandlers.set(cacheKey, handler);
  }
  return handler;
};

export const handleProtectedMcpPost = (
  request: Request,
  env: Env,
  log?: AuditableLogger
): Promise<Response> => {
  const envKey = mcpEnvKey(env);
  if (cachedProtectedGate?.envKey !== envKey) {
    cachedProtectedGate = {
      envKey,
      gate: createProtectedMcpHandler(env, (mcpRequest, userId) =>
        getUserMcpHandler(env, userId).fetch(mcpRequest)
      ),
    };
  }
  if (!cachedProtectedGate) {
    throw new Error('MCP handler is not initialized');
  }
  const { gate } = cachedProtectedGate;
  return runWithInboundRequestSignal(request.signal, () => gate(request, log));
};
