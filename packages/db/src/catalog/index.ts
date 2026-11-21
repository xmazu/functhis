import type { CatalogPorts } from '@functhis/core/publish';
import type { PlatformPorts } from '@functhis/platform';

import type { Database } from '../index';
import { createCatalogReadPort } from './catalog-read';
import { createExecutionLogPort } from './execution-log';
import { createHotCatalogSourcePort } from './hot-source';
import { createIdempotencyStorePort } from './idempotency';
import { createMembershipsPort } from './memberships';
import { createPackageStorePort } from './packages';
import { createExecutionQuotaPort } from './quota';
import { createRuntimeSecretsPort } from './runtime-secrets';
import { createSecretDirectoryPort } from './secret-directory';
import { createSourceStorePort } from './sources';

export const createCatalog = (database: Database): CatalogPorts => ({
  executionLog: createExecutionLogPort(database),
  hotSource: createHotCatalogSourcePort(database),
  idempotency: createIdempotencyStorePort(database),
  packages: createPackageStorePort(database),
  runtimeSecrets: createRuntimeSecretsPort(database),
  sources: createSourceStorePort(database),
});

export const createPlatform = (database: Database): PlatformPorts => ({
  catalogRead: createCatalogReadPort(database),
  memberships: createMembershipsPort(database),
  packages: createPackageStorePort(database),
  quota: createExecutionQuotaPort(database),
  secretDirectory: createSecretDirectoryPort(database),
});
