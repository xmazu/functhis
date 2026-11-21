import {
  utf8ByteLength,
  encryptSecretValue,
  HostedSecretError,
  resolveSecretsKeyBytes,
  SECRETS_KEY_VERSION,
  isValidSecretName,
  MAX_SECRET_VALUE_BYTES,
} from '@functhis/core/publish';
import type {
  HostedSecretListItem,
  SecretDirectoryPort,
} from '@functhis/core/publish';

import { and, eq, isNull } from '../drizzle';
import type { Database } from '../index';
import { hostedSecret, pkg } from '../schema/catalog';
import {
  canWritePackageSecrets,
  isMemberOfOrganization,
  isOrgSecretsAdmin,
} from './secret-access';

const assertValidSecretInput = (name: string, value: string): void => {
  if (!isValidSecretName(name)) {
    throw new HostedSecretError('Invalid secret name', 'invalid_name');
  }
  if (value.length === 0 || utf8ByteLength(value) > MAX_SECRET_VALUE_BYTES) {
    throw new HostedSecretError('Invalid secret value', 'invalid_value');
  }
};

const toListItem = (
  row: {
    lastUsedAt: Date | null;
    name: string;
    packageId: string | null;
    updatedAt: Date;
  },
  scope: 'organization' | 'package'
): HostedSecretListItem => ({
  lastUsedAt: row.lastUsedAt,
  name: row.name,
  scope,
  updatedAt: row.updatedAt,
});

const upsertSecretRow = async (
  database: Database,
  input: {
    ciphertext: string;
    name: string;
    nonce: string;
    organizationId: string;
    packageId: string | null;
    updatedBy: string;
  }
): Promise<void> => {
  const existingQuery =
    input.packageId === null
      ? and(
          eq(hostedSecret.organizationId, input.organizationId),
          eq(hostedSecret.name, input.name),
          isNull(hostedSecret.packageId)
        )
      : and(
          eq(hostedSecret.packageId, input.packageId),
          eq(hostedSecret.name, input.name)
        );

  const [existing] = await database
    .select({ id: hostedSecret.id })
    .from(hostedSecret)
    .where(existingQuery)
    .limit(1);

  if (existing) {
    await database
      .update(hostedSecret)
      .set({
        ciphertext: input.ciphertext,
        keyVersion: SECRETS_KEY_VERSION,
        nonce: input.nonce,
        updatedBy: input.updatedBy,
      })
      .where(eq(hostedSecret.id, existing.id));
    return;
  }

  await database.insert(hostedSecret).values({
    ciphertext: input.ciphertext,
    keyVersion: SECRETS_KEY_VERSION,
    name: input.name,
    nonce: input.nonce,
    organizationId: input.organizationId,
    packageId: input.packageId,
    updatedBy: input.updatedBy,
  });
};

const loadPackageRow = async (
  database: Database,
  packageId: string
): Promise<{
  id: string;
  organizationId: string;
  ownerUserId: string;
} | null> => {
  const [row] = await database
    .select({
      id: pkg.id,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
    })
    .from(pkg)
    .where(eq(pkg.id, packageId))
    .limit(1);
  return row ?? null;
};

export const createSecretDirectoryPort = (
  database: Database
): SecretDirectoryPort => ({
  async deleteOrganizationSecret(input) {
    if (
      !(await isOrgSecretsAdmin(database, input.userId, input.organizationId))
    ) {
      throw new HostedSecretError('Unauthorized', 'unauthorized');
    }
    if (!isValidSecretName(input.name)) {
      throw new HostedSecretError('Invalid secret name', 'invalid_name');
    }

    await database
      .delete(hostedSecret)
      .where(
        and(
          eq(hostedSecret.organizationId, input.organizationId),
          eq(hostedSecret.name, input.name),
          isNull(hostedSecret.packageId)
        )
      );
  },

  async deletePackageSecret(input) {
    const packageRow = await loadPackageRow(database, input.packageId);
    if (!packageRow) {
      throw new Error('Package not found');
    }
    if (!(await canWritePackageSecrets(database, input.userId, packageRow))) {
      throw new HostedSecretError('Unauthorized', 'unauthorized');
    }
    if (!isValidSecretName(input.name)) {
      throw new HostedSecretError('Invalid secret name', 'invalid_name');
    }

    await database
      .delete(hostedSecret)
      .where(
        and(
          eq(hostedSecret.packageId, packageRow.id),
          eq(hostedSecret.name, input.name)
        )
      );
  },

  async listOrganizationSecrets(userId, organizationId) {
    const isMember = await isMemberOfOrganization(
      database,
      userId,
      organizationId
    );
    if (!isMember) {
      return null;
    }

    const [rows, canWrite] = await Promise.all([
      database
        .select({
          lastUsedAt: hostedSecret.lastUsedAt,
          name: hostedSecret.name,
          packageId: hostedSecret.packageId,
          updatedAt: hostedSecret.updatedAt,
        })
        .from(hostedSecret)
        .where(
          and(
            eq(hostedSecret.organizationId, organizationId),
            isNull(hostedSecret.packageId)
          )
        ),
      isOrgSecretsAdmin(database, userId, organizationId),
    ]);

    return {
      canWrite,
      secrets: rows
        .map((row) => toListItem(row, 'organization'))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
    };
  },

  async listPackageSecrets(userId, packageRow) {
    const canWrite = await canWritePackageSecrets(database, userId, packageRow);
    if (!canWrite && packageRow.ownerUserId !== userId) {
      const isMember = await isMemberOfOrganization(
        database,
        userId,
        packageRow.organizationId
      );
      if (!isMember) {
        return null;
      }
    }

    const rows = await database
      .select({
        lastUsedAt: hostedSecret.lastUsedAt,
        name: hostedSecret.name,
        packageId: hostedSecret.packageId,
        updatedAt: hostedSecret.updatedAt,
      })
      .from(hostedSecret)
      .where(eq(hostedSecret.packageId, packageRow.id));

    return {
      canWrite,
      secrets: rows
        .map((row) => toListItem(row, 'package'))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
    };
  },

  async setOrganizationSecret(input) {
    if (
      !(await isOrgSecretsAdmin(database, input.userId, input.organizationId))
    ) {
      throw new HostedSecretError('Unauthorized', 'unauthorized');
    }

    assertValidSecretInput(input.name, input.value);
    const keyBytes = await resolveSecretsKeyBytes(input.encryptionKey);
    const encrypted = await encryptSecretValue(input.value, keyBytes);
    await upsertSecretRow(database, {
      ciphertext: encrypted.ciphertext,
      name: input.name,
      nonce: encrypted.nonce,
      organizationId: input.organizationId,
      packageId: null,
      updatedBy: input.userId,
    });

    return {
      lastUsedAt: null,
      name: input.name,
      scope: 'organization',
      updatedAt: new Date(),
    };
  },

  async setPackageSecret(input) {
    const packageRow = await loadPackageRow(database, input.packageId);
    if (!packageRow) {
      throw new Error('Package not found');
    }
    if (!(await canWritePackageSecrets(database, input.userId, packageRow))) {
      throw new HostedSecretError('Unauthorized', 'unauthorized');
    }

    assertValidSecretInput(input.name, input.value);
    const keyBytes = await resolveSecretsKeyBytes(input.encryptionKey);
    const encrypted = await encryptSecretValue(input.value, keyBytes);
    await upsertSecretRow(database, {
      ciphertext: encrypted.ciphertext,
      name: input.name,
      nonce: encrypted.nonce,
      organizationId: input.organizationId,
      packageId: packageRow.id,
      updatedBy: input.userId,
    });

    return {
      lastUsedAt: null,
      name: input.name,
      scope: 'package',
      updatedAt: new Date(),
    };
  },
});
