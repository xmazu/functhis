import { LAST_USED_TOUCH_INTERVAL_MS } from '@functhis/core/publish/hosted-secrets';
import type { RuntimeSecretsPort } from '@functhis/core/publish/ports';
import {
  decryptSecretRows,
  resolveSecretsKeyBytes,
} from '@functhis/core/publish/secret-crypto';
import { mergeSecretValues } from '@functhis/core/publish/secret-names';

import { and, eq, inArray, isNull, or } from '../drizzle';
import type { Database } from '../index';
import { hostedSecret, packageVersion } from '../schema/catalog';

const shouldTouchLastUsedAt = (lastUsedAt: Date | null): boolean =>
  lastUsedAt === null ||
  Date.now() - lastUsedAt.getTime() >= LAST_USED_TOUCH_INTERVAL_MS;

const touchSecretsLastUsedAt = async (
  database: Database,
  secretIds: string[]
): Promise<void> => {
  if (secretIds.length === 0) {
    return;
  }
  const usedAt = new Date();
  await database
    .update(hostedSecret)
    .set({ lastUsedAt: usedAt })
    .where(inArray(hostedSecret.id, secretIds));
};

export const createRuntimeSecretsPort = (
  database: Database
): RuntimeSecretsPort => ({
  async loadPackageVersionSecretNames(versionId) {
    const [row] = await database
      .select({ secretNames: packageVersion.secretNames })
      .from(packageVersion)
      .where(eq(packageVersion.id, versionId))
      .limit(1);

    return row?.secretNames ?? [];
  },

  async resolveRuntimeSecrets(input) {
    if (input.secretNames.length === 0) {
      return {};
    }

    const keyBytes = await resolveSecretsKeyBytes(input.encryptionKey);
    const rows = await database
      .select({
        ciphertext: hostedSecret.ciphertext,
        id: hostedSecret.id,
        lastUsedAt: hostedSecret.lastUsedAt,
        name: hostedSecret.name,
        nonce: hostedSecret.nonce,
        packageId: hostedSecret.packageId,
      })
      .from(hostedSecret)
      .where(
        and(
          inArray(hostedSecret.name, [...input.secretNames]),
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
    const merged = mergeSecretValues(decrypted.organization, decrypted.pkg);

    const secretIdsToTouch: string[] = [];
    for (const name of input.secretNames) {
      if (!(name in merged)) {
        continue;
      }
      const packageRow = rows.find(
        (row) => row.name === name && row.packageId !== null
      );
      const organizationRow = rows.find(
        (row) => row.name === name && row.packageId === null
      );
      const winningRow = packageRow ?? organizationRow;
      if (winningRow && shouldTouchLastUsedAt(winningRow.lastUsedAt ?? null)) {
        secretIdsToTouch.push(winningRow.id);
      }
    }

    await touchSecretsLastUsedAt(database, secretIdsToTouch);
    return merged;
  },
});
