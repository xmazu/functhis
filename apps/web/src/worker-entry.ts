import type { ExecutionContext } from '@cloudflare/workers-types';
import { createEvlogTanstackWorkerEntry } from '@functhis/config/evlog-worker-entry';

import { rewriteOAuthDiscoveryRequest } from './lib/auth/auth-handler-path';

const tanstack = createEvlogTanstackWorkerEntry('functhis-web');

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return tanstack.fetch(rewriteOAuthDiscoveryRequest(request), env, ctx);
  },
};
