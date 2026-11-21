import type { CatalogPorts, HotKvBinding } from '@functhis/core/publish';

import type { PlatformPorts } from '../ports';

export type PublishAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export interface PublishHandlerContext {
  artifacts: { put: (key: string, value: string) => Promise<void> };
  authenticatePublish: (request: Request) => Promise<PublishAuthResult>;
  bundles: { put: (key: string, value: string) => Promise<void> };
  catalog: CatalogPorts;
  hot: HotKvBinding;
  platform: PlatformPorts;
}
