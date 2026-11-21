import type { RuntimeSecretsPort } from '../ports';
import type { SecretBinding } from '../secret-binding';

/** Skip `last_used_at` writes when touched within this window (execute hot path). */
export const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const loadPackageVersionSecretNames = (
  runtime: RuntimeSecretsPort,
  versionId: string
): Promise<string[]> => runtime.loadPackageVersionSecretNames(versionId);

export const resolveHostedRuntimeSecrets = (
  runtime: RuntimeSecretsPort,
  input: {
    encryptionKey: SecretBinding | undefined;
    packageId: string;
    secretNames: string[];
  }
): Promise<Record<string, string>> =>
  runtime.resolveRuntimeSecrets({
    encryptionKey: input.encryptionKey,
    packageId: input.packageId,
    secretNames: input.secretNames,
  });

export { decryptSecretRows } from './secret-crypto';
