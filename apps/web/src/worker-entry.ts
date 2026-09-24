import type { ExecutionContext } from '@cloudflare/workers-types';
import { createEvlogTanstackWorkerEntry } from '@functhis/config/evlog-worker-entry';

import {
  handlePublicFunctionRequest,
  handlePublicPackageRequest,
} from './server/public-url/handlers';
import { matchPublicPath } from './server/public-url/routing';

const tanstack = createEvlogTanstackWorkerEntry('functhis-web');

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const publicParams = matchPublicPath(new URL(request.url).pathname);
    if (publicParams) {
      const { functionSlug, handle, packageSlug } = publicParams;

      if (functionSlug) {
        return handlePublicFunctionRequest(request, {
          function: functionSlug,
          handle,
          package: packageSlug,
        });
      }

      return handlePublicPackageRequest(request, {
        handle,
        package: packageSlug,
      });
    }

    return tanstack.fetch(request, env, ctx);
  },
};
