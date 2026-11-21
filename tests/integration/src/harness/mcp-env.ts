import type { McpBindings, McpHostedPolicy } from '@functhis/core/mcp';
import type {
  SearchLoadPolicy,
  CatalogPorts,
  HotKvBinding,
} from '@functhis/core/publish';
import {
  buildAccessContextFromHotKv,
  canAccessPackage,
  getMembershipOrganizationIdsFromHot,
} from '@functhis/platform';
import type { PlatformPorts } from '@functhis/platform';

import type { MemoryHotKv } from './memory-hot-kv';

const INTEGRATION_SECRETS_KEY = 'integration-test-secrets-key-32b!';

export const integrationHotBinding = (memoryHot: MemoryHotKv): HotKvBinding =>
  memoryHot;

const createIntegrationHostedPolicy = (
  _hot: HotKvBinding,
  _platform: PlatformPorts
): McpHostedPolicy => ({
  buildAccessContext: (hotKv, callerUserId) =>
    callerUserId
      ? buildAccessContextFromHotKv(hotKv, callerUserId)
      : Promise.resolve({ organizationIds: [], userId: null }),
  canAccessPackage,
  isQuotaExceeded: () => false,
  quotaErrorMessage: () => 'quota exceeded',
  reserveExecution: async () => {
    /* integration noop */
  },
  resolveFinalizeTelemetry: () => Promise.resolve({ emitTelemetry: false }),
});

export const createIntegrationSearchLoadPolicy = (
  hot: HotKvBinding,
  platform: PlatformPorts
): SearchLoadPolicy => ({
  accessContext: (callerUserId) =>
    buildAccessContextFromHotKv(hot, callerUserId),
  canAccessPackage,
  organizationIds: (callerUserId) =>
    getMembershipOrganizationIdsFromHot(
      hot,
      platform.memberships,
      callerUserId
    ),
});

export const evalSearchLoadPolicy = (
  organizationId: string
): SearchLoadPolicy => ({
  accessContext: (userId) =>
    Promise.resolve({ organizationIds: [organizationId], userId }),
  canAccessPackage: () => true,
  organizationIds: () => Promise.resolve([organizationId]),
});

export const createIntegrationMcpBindings = (
  memoryHot: MemoryHotKv,
  catalog: CatalogPorts,
  platform: PlatformPorts
): McpBindings =>
  ({
    ANALYTICS: {
      writeDataPoint: () => {
        /* integration noop */
      },
    },
    BUNDLES: { get: () => Promise.resolve(null) },
    FUNCTHIS_SECRETS_KEY: INTEGRATION_SECRETS_KEY,
    HOT: memoryHot,
    LOADER: {
      get: () => ({
        getEntrypoint: () => ({
          fetch: () => Promise.resolve(new Response('{}')),
        }),
      }),
    },
    catalog,
    hostedPolicy: createIntegrationHostedPolicy(memoryHot, platform),
    searchLoadPolicy: createIntegrationSearchLoadPolicy(memoryHot, platform),
  }) as McpBindings;
