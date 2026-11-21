import type { RuntimeSecretsPort, SecretDirectoryPort } from '../ports';
import type { SecretBinding } from '../secret-binding';

export type HostedSecretScope = 'organization' | 'package';

/** Skip `last_used_at` writes when touched within this window (execute hot path). */
export const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface HostedSecretListItem {
  lastUsedAt: Date | null;
  name: string;
  scope: HostedSecretScope;
  updatedAt: Date;
}

export interface HostedSecretListResult {
  canWrite: boolean;
  secrets: HostedSecretListItem[];
}

export const listOrganizationSecrets = (
  directory: SecretDirectoryPort,
  userId: string,
  organizationId: string
): Promise<HostedSecretListResult | null> =>
  directory.listOrganizationSecrets(userId, organizationId);

export const listPackageSecrets = (
  directory: SecretDirectoryPort,
  userId: string,
  packageRow: { id: string; organizationId: string; ownerUserId: string }
): Promise<HostedSecretListResult | null> =>
  directory.listPackageSecrets(userId, packageRow);

export const setOrganizationSecret = (
  directory: SecretDirectoryPort,
  input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    organizationId: string;
    userId: string;
    value: string;
  }
): Promise<HostedSecretListItem> => directory.setOrganizationSecret(input);

export const setPackageSecret = (
  directory: SecretDirectoryPort,
  input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    packageRow: { id: string; organizationId: string; ownerUserId: string };
    userId: string;
    value: string;
  }
): Promise<HostedSecretListItem> =>
  directory.setPackageSecret({
    encryptionKey: input.encryptionKey,
    name: input.name,
    organizationId: input.packageRow.organizationId,
    packageId: input.packageRow.id,
    userId: input.userId,
    value: input.value,
  });

export const deleteOrganizationSecret = (
  directory: SecretDirectoryPort,
  input: { name: string; organizationId: string; userId: string }
): Promise<void> => directory.deleteOrganizationSecret(input);

export const deletePackageSecret = (
  directory: SecretDirectoryPort,
  input: {
    name: string;
    packageRow: { id: string; organizationId: string; ownerUserId: string };
    userId: string;
  }
): Promise<void> =>
  directory.deletePackageSecret({
    name: input.name,
    packageId: input.packageRow.id,
    userId: input.userId,
  });

export { decryptSecretRows } from './secret-crypto';

export const loadPackageVersionSecretNames = (
  runtime: RuntimeSecretsPort,
  versionId: string
): Promise<string[]> => runtime.loadPackageVersionSecretNames(versionId);

export const resolveHostedRuntimeSecrets = (
  runtime: RuntimeSecretsPort,
  input: {
    encryptionKey: SecretBinding | undefined;
    organizationId: string;
    packageId: string;
    secretNames: string[];
  }
): Promise<Record<string, string>> =>
  runtime.resolveRuntimeSecrets({
    encryptionKey: input.encryptionKey,
    organizationId: input.organizationId,
    packageId: input.packageId,
    secretNames: input.secretNames,
  });
