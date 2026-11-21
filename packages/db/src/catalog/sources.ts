import type { SourceStorePort } from '@functhis/core/publish/ports';

import type { Database } from '../index';
import {
  acceptOpenApiGeneration,
  persistImportOpenApi,
  rollbackOpenApiGeneration,
} from './sources-openapi';
import type {
  AcceptOpenApiGenerationInput,
  PersistImportOpenApiInput,
  RollbackOpenApiGenerationInput,
} from './sources-openapi';
import { persistRemoteMcpSync } from './sources-remote';
import type { PersistRemoteMcpSyncInput } from './sources-remote';

const isAcceptOpenApiGenerationInput = (
  value: unknown
): value is AcceptOpenApiGenerationInput =>
  typeof value === 'object' &&
  value !== null &&
  'sourceId' in value &&
  typeof (value as AcceptOpenApiGenerationInput).sourceId === 'string';

const isRollbackOpenApiGenerationInput = (
  value: unknown
): value is RollbackOpenApiGenerationInput =>
  typeof value === 'object' &&
  value !== null &&
  'sourceId' in value &&
  'generation' in value &&
  typeof (value as RollbackOpenApiGenerationInput).sourceId === 'string' &&
  typeof (value as RollbackOpenApiGenerationInput).generation === 'number';

const isPersistImportOpenApiInput = (
  value: unknown
): value is PersistImportOpenApiInput =>
  typeof value === 'object' &&
  value !== null &&
  'organizationId' in value &&
  'ownerUserId' in value &&
  'slug' in value &&
  'spec' in value &&
  typeof (value as PersistImportOpenApiInput).organizationId === 'string' &&
  typeof (value as PersistImportOpenApiInput).ownerUserId === 'string' &&
  typeof (value as PersistImportOpenApiInput).slug === 'string' &&
  typeof (value as PersistImportOpenApiInput).spec === 'object' &&
  (value as PersistImportOpenApiInput).spec !== null;

const isPersistRemoteMcpSyncInput = (
  value: unknown
): value is PersistRemoteMcpSyncInput =>
  typeof value === 'object' &&
  value !== null &&
  'endpoint' in value &&
  'organizationId' in value &&
  'ownerUserId' in value &&
  'slug' in value &&
  'tools' in value &&
  typeof (value as PersistRemoteMcpSyncInput).endpoint === 'string' &&
  typeof (value as PersistRemoteMcpSyncInput).organizationId === 'string' &&
  typeof (value as PersistRemoteMcpSyncInput).ownerUserId === 'string' &&
  typeof (value as PersistRemoteMcpSyncInput).slug === 'string' &&
  Array.isArray((value as PersistRemoteMcpSyncInput).tools);

export const createSourceStorePort = (database: Database): SourceStorePort => ({
  async acceptOpenApiGeneration(input: unknown) {
    if (!isAcceptOpenApiGenerationInput(input)) {
      throw new Error('Invalid acceptOpenApiGeneration input');
    }
    await acceptOpenApiGeneration(database, input);
  },

  commitOpenApiImport(input: unknown) {
    if (!isPersistImportOpenApiInput(input)) {
      throw new Error('Invalid commitOpenApiImport input');
    }
    return persistImportOpenApi(database, input);
  },

  async rollbackOpenApiGeneration(input: unknown) {
    if (!isRollbackOpenApiGenerationInput(input)) {
      throw new Error('Invalid rollbackOpenApiGeneration input');
    }
    await rollbackOpenApiGeneration(database, input);
  },

  syncRemoteMcpSource(input: unknown) {
    if (!isPersistRemoteMcpSyncInput(input)) {
      throw new Error('Invalid syncRemoteMcpSource input');
    }
    return persistRemoteMcpSync(database, input);
  },
});
