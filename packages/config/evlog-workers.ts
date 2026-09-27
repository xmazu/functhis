import type { AuditableLogger } from 'evlog';
import { initWorkersLogger, withEvlog } from 'evlog/workers';
import type {
  EvlogWorkersOptions,
  WorkerExecutionContext,
} from 'evlog/workers';

export type EvlogWorkerFetchHandler<TEnv> = (
  request: Request,
  env: TEnv,
  ctx: WorkerExecutionContext,
  log: AuditableLogger
) => Response | Promise<Response>;

/** Cloudflare Worker `fetch` with one evlog wide event per request (dev terminal in local). */
export const createEvlogWorkerFetch = <TEnv>(
  service: string,
  handler: EvlogWorkerFetchHandler<TEnv>,
  options?: EvlogWorkersOptions
) => {
  initWorkersLogger({
    env: { service },
    pretty: true,
  });

  return withEvlog(handler, options);
};
