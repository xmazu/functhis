import type { Database } from '@functhis/db';

export type DeployAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface DeployHandlerContext {
  authenticateDeploy: (request: Request) => Promise<DeployAuthResult>;
  bundles: { put: (key: string, value: string) => Promise<void> };
  db: Database;
}
