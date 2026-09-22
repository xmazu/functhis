import type { Database } from '@functhis/db';

import type { TextEmbeddingRunner } from './function-search-text';

export type DeployAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface DeployHandlerContext {
  ai?: TextEmbeddingRunner;
  authenticateDeploy: (request: Request) => Promise<DeployAuthResult>;
  bundles: { put: (key: string, value: string) => Promise<void> };
  db: Database;
}
