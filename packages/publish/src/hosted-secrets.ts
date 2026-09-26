import type { Database, SecretBinding } from '@functhis/db';
import { hostedSecret, packageVersion } from '@functhis/db/schema/catalog';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { utf8ByteLength } from './bundle';
import { isMemberOfOrganization } from './org-membership-read';
import { canWritePackageSecrets, isOrgSecretsAdmin } from './secret-access';
import {
  decryptSecretValue,
  encryptSecretValue,
  HostedSecretError,
  resolveSecretsKeyBytes,
  SECRETS_KEY_VERSION,
} from './secret-crypto';
import {
  isValidSecretName,
  MAX_SECRET_VALUE_BYTES,
  mergeSecretValues,
} from './secret-names';

export type HostedSecretScope = 'organization' | 'package';

export interface HostedSecretListItem {
  name: string;
  scope: HostedSecretScope;
  updatedAt: Date;
}

export interface HostedSecretListResult {
  canWrite: boolean;
  secrets: HostedSecretListItem[];
}

const assertValidSecretInput = (name: string, value: string): void => {
  if (!isValidSecretName(name)) {
    throw new HostedSecretError('Invalid secret name', 'invalid_name');
  }
  if (value.length === 0 || utf8ByteLength(value) > MAX_SECRET_VALUE_BYTES) {
    throw new HostedSecretError('Invalid secret value', 'invalid_value');
  }
};

const toListItem = (
  row: { name: string; packageId: string | null; updatedAt: Date },
  scope: HostedSecretScope
): HostedSecretListItem => ({
  name: row.name,
  scope,
  updatedAt: row.updatedAt,
});

export const listOrganizationSecrets = async (
  database: Database,
  userId: string,
  organizationId: string
): Promise<HostedSecretListResult | null> => {
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
};

export const listPackageSecrets = async (
  database: Database,
  userId: string,
  packageRow: { id: string; organizationId: string; ownerUserId: string }
): Promise<HostedSecretListResult | null> => {
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
};

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

export const setOrganizationSecret = async (
  database: Database,
  input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    organizationId: string;
    userId: string;
    value: string;
  }
): Promise<HostedSecretListItem> => {
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
    name: input.name,
    scope: 'organization',
    updatedAt: new Date(),
  };
};

export const setPackageSecret = async (
  database: Database,
  input: {
    encryptionKey: SecretBinding | undefined;
    name: string;
    packageRow: { id: string; organizationId: string; ownerUserId: string };
    userId: string;
    value: string;
  }
): Promise<HostedSecretListItem> => {
  if (
    !(await canWritePackageSecrets(database, input.userId, input.packageRow))
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
    organizationId: input.packageRow.organizationId,
    packageId: input.packageRow.id,
    updatedBy: input.userId,
  });

  return {
    name: input.name,
    scope: 'package',
    updatedAt: new Date(),
  };
};

export const deleteOrganizationSecret = async (
  database: Database,
  input: { name: string; organizationId: string; userId: string }
): Promise<void> => {
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
};

export const deletePackageSecret = async (
  database: Database,
  input: {
    name: string;
    packageRow: { id: string; organizationId: string; ownerUserId: string };
    userId: string;
  }
): Promise<void> => {
  if (
    !(await canWritePackageSecrets(database, input.userId, input.packageRow))
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
        eq(hostedSecret.packageId, input.packageRow.id),
        eq(hostedSecret.name, input.name)
      )
    );
};

export const loadPackageVersionSecretNames = async (
  database: Database,
  versionId: string
): Promise<string[]> => {
  const [row] = await database
    .select({ secretNames: packageVersion.secretNames })
    .from(packageVersion)
    .where(eq(packageVersion.id, versionId))
    .limit(1);

  return row?.secretNames ?? [];
};

export const decryptSecretRows = async (
  rows: {
    ciphertext: string;
    name: string;
    nonce: string;
    packageId: string | null;
  }[],
  keyBytes: Uint8Array
): Promise<{
  organization: Record<string, string>;
  pkg: Record<string, string>;
}> => {
  const organization: Record<string, string> = {};
  const pkg: Record<string, string> = {};

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      name: row.name,
      packageId: row.packageId,
      value: await decryptSecretValue(
        { ciphertext: row.ciphertext, nonce: row.nonce },
        keyBytes
      ),
    }))
  );

  for (const row of decrypted) {
    if (row.packageId === null) {
      organization[row.name] = row.value;
    } else {
      pkg[row.name] = row.value;
    }
  }

  return { organization, pkg };
};

export const resolveHostedRuntimeSecrets = async (
  database: Database,
  input: {
    encryptionKey: SecretBinding | undefined;
    organizationId: string;
    packageId: string;
    secretNames: string[];
  }
): Promise<Record<string, string>> => {
  if (input.secretNames.length === 0) {
    return {};
  }

  const keyBytes = await resolveSecretsKeyBytes(input.encryptionKey);
  const rows = await database
    .select({
      ciphertext: hostedSecret.ciphertext,
      name: hostedSecret.name,
      nonce: hostedSecret.nonce,
      packageId: hostedSecret.packageId,
    })
    .from(hostedSecret)
    .where(
      and(
        inArray(hostedSecret.name, input.secretNames),
        or(
          and(
            eq(hostedSecret.organizationId, input.organizationId),
            isNull(hostedSecret.packageId)
          ),
          eq(hostedSecret.packageId, input.packageId)
        )
      )
    );

  const decrypted = await decryptSecretRows(rows, keyBytes);
  return mergeSecretValues(decrypted.organization, decrypted.pkg);
};
