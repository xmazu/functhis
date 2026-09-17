import tanstackServer from '@tanstack/react-start/server-entry';
import { initWorkersLogger, withEvlog } from 'evlog/workers';

/**
 * TanStack Start on Cloudflare uses the Workers `fetch` handler, not Nitro at
 * runtime — `nitro.config.ts` evlog only wires build/error UI. Wrap the worker
 * entry so each request emits a wide event to the dev terminal.
 */
export const createEvlogTanstackWorkerEntry = (service: string) => {
  initWorkersLogger({
    env: { service },
    pretty: import.meta.env.DEV,
  });

  const fetchTanstack = tanstackServer.fetch as (
    request: Request,
    ...args: unknown[]
  ) => ReturnType<typeof tanstackServer.fetch>;

  return withEvlog((request, env, ctx) => fetchTanstack(request, env, ctx));
};
