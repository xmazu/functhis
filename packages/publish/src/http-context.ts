import type { Database } from '@functhis/db';

import type { TextEmbeddingRunner } from './function-search-text';

export type PublishAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface PublishHandlerContext {
  ai?: TextEmbeddingRunner;
  artifacts: { put: (key: string, value: string) => Promise<void> };
  authenticatePublish: (request: Request) => Promise<PublishAuthResult>;
  bundles: { put: (key: string, value: string) => Promise<void> };
  db: Database;
}
