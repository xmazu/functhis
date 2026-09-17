import { createFuncthisMcpHandler } from './mcp';
import { createProtectedMcpHandler } from './protect';

const mcpEnvKey = (env: Env): string =>
  `${env.CONSOLE_URL}\0${env.MCP_RESOURCE}`;

let cachedProtectedGate:
  | {
      envKey: string;
      gate: (request: Request) => Promise<Response>;
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
  env: Env
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
  return cachedProtectedGate.gate(request);
};
