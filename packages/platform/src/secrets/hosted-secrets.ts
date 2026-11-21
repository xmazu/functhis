import type { SecretBinding } from '@functhis/core/publish';

import type { SecretDirectoryPort } from '../ports';

export type HostedSecretScope = 'organization' | 'package';

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
