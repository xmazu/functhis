import { createEvlogWorkerFetch } from '@functhis/config/evlog-workers';
import type { McpBindings } from '@functhis/core';
import { reconcileMcpSearchIndex } from '@functhis/core';
import type { AuditableLogger } from 'evlog';

import { handleFuncthisMcpWorkerRequest } from './functhis-worker';

const asMcpBindings = (env: Env): McpBindings => env as McpBindings;

const routeFetch = (
  request: Request,
  env: Env,
  _ctx: unknown,
  log: AuditableLogger
): Response | Promise<Response> =>
  handleFuncthisMcpWorkerRequest(request, asMcpBindings(env), log);

const instrumented = createEvlogWorkerFetch('functhis-mcp', routeFetch);

export default {
  fetch: instrumented.fetch,
  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): void {
    ctx.waitUntil(reconcileMcpSearchIndex(asMcpBindings(env)));
  },
};
