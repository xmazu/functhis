import type { ExecutionContext } from '@cloudflare/workers-types';
import { createEvlogTanstackWorkerEntry } from '@functhis/config/evlog-worker-entry';

import {
  handlePublicFunctionRequest,
  handlePublicPackageRequest,
} from './server/public-url/handlers';

const tanstack = createEvlogTanstackWorkerEntry('functhis-web');

const PUBLIC_PATH =
  /^\/@(?<handle>[^/]+)\/(?<package>[^/]+)(?:\/(?<function>[^/]+))?\/?$/u;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const match = PUBLIC_PATH.exec(new URL(request.url).pathname);
    if (match?.groups) {
      const {
        function: functionSlug,
        handle,
        package: packageSlug,
      } = match.groups;

      if (!handle || !packageSlug) {
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      }

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
