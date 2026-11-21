import { createMcpWorkerHandler } from '@functhis/core';

import { authenticateFuncthisMcp, functhisMcpCacheKey } from './authenticate';
import { functhisOAuthProtectedResourceWellKnown } from './prm';

export const handleFuncthisMcpWorkerRequest = createMcpWorkerHandler({
  authenticate: authenticateFuncthisMcp,
  cacheKey: functhisMcpCacheKey,
  wellKnown: [functhisOAuthProtectedResourceWellKnown],
});
