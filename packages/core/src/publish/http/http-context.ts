import type { Database } from '@functhis/db';

export type PublishAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface HotKvBinding {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ) => Promise<void>;
}

export interface PublishHandlerContext {
  artifacts: { put: (key: string, value: string) => Promise<void> };
  authenticatePublish: (request: Request) => Promise<PublishAuthResult>;
  bundles: { put: (key: string, value: string) => Promise<void> };
  db: Database;
  hot: HotKvBinding;
}
