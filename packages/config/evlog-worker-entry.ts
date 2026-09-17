import tanstackServer from '@tanstack/react-start/server-entry';
import { initLogger } from 'evlog';
import { withEvlog } from 'evlog/workers';

/**
 * TanStack Start on Cloudflare uses the Workers `fetch` handler, not Nitro at
 * runtime — `nitro.config.ts` evlog only wires build/error UI. Wrap the worker
 * entry so each request emits a wide event to the dev terminal.
 */
export const createEvlogTanstackWorkerEntry = (service: string) => {
  initLogger({
    env: { service },
    pretty: import.meta.env.DEV,
  });

  return withEvlog(
    (request, env, ctx) => tanstackServer.fetch(request, env, ctx),
    { env: { service } }
  );
};
