import { createEvlogWorkerFetch } from '@functhis/config/evlog-workers';
import type { McpBindings } from '@functhis/core/mcp';
import { reconcileMcpSearchIndex } from '@functhis/core/mcp';
import { asHotKvBinding } from '@functhis/core/publish';
import { createDb } from '@functhis/db';
import { createCatalog, createPlatform } from '@functhis/db/catalog';
import type { AuditableLogger } from 'evlog';

import { handleFuncthisMcpWorkerRequest } from './functhis-worker';
import { createHostedPolicy, createSearchLoadPolicy } from './hosted-policy';

const asMcpBindings = async (env: Env): Promise<McpBindings> => {
  const database = await createDb({ HYPERDRIVE: env.HYPERDRIVE });
  const platform = createPlatform(database);
  const catalog = createCatalog(database);
  const HOT = asHotKvBinding(env.HOT);
  return {
    ...env,
    HOT,
    catalog,
    hostedPolicy: createHostedPolicy({ HOT, platform }),
    searchLoadPolicy: createSearchLoadPolicy({ HOT, platform }),
  } satisfies McpBindings;
};

const routeFetch = async (
  request: Request,
  env: Env,
  _ctx: unknown,
  log: AuditableLogger
): Promise<Response> =>
  handleFuncthisMcpWorkerRequest(request, await asMcpBindings(env), log);

const instrumented = createEvlogWorkerFetch('functhis-mcp', routeFetch);

export default {
  fetch: instrumented.fetch,
  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): void {
    ctx.waitUntil(
      (async () => {
        const bindings = await asMcpBindings(env);
        await reconcileMcpSearchIndex(bindings);
      })()
    );
  },
};
