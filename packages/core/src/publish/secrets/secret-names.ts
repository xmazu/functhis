import { z } from 'zod';

export const SECRET_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;
export const MAX_SECRET_NAME_LENGTH = 64;
export const MAX_SECRET_VALUE_BYTES = 8192;

export const isValidSecretName = (name: string): boolean =>
  name.length > 0 &&
  name.length <= MAX_SECRET_NAME_LENGTH &&
  SECRET_NAME_PATTERN.test(name);

const manifestSecretsSchema = z.object({
  secrets: z.array(z.string()).optional(),
});

export const parseSecretNamesFromManifestJson = (
  manifestJson: string
): string[] => {
  try {
    const parsed = manifestSecretsSchema.safeParse(JSON.parse(manifestJson));
    if (!parsed.success) {
      return [];
    }

    const names = new Set<string>();
    for (const name of parsed.data.secrets ?? []) {
      if (isValidSecretName(name)) {
        names.add(name);
      }
    }
    return [...names].toSorted();
  } catch {
    return [];
  }
};

export const mergeSecretValues = (
  organization: Record<string, string>,
  pkg: Record<string, string>
): Record<string, string> => ({ ...organization, ...pkg });
