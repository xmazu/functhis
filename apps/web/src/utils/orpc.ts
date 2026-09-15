import { appRouter } from '@functhis/api/routers/index';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createRouterClient } from '@orpc/server';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { toast } from 'sonner';

import { createContext } from '../context';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: 'retry',
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(appRouter, {
      context: () => createContext({ req: getRequest() }),
    })
  )
  .client((): RouterClient<typeof appRouter> => {
    const link = new RPCLink({
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
      url: `${window.location.origin}/api/rpc`,
    });

    return createORPCClient(link);
  });

export const client: RouterClient<typeof appRouter> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
