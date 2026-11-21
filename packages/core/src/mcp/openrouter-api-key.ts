import type { SecretBinding } from '@functhis/db';

export const resolveOpenRouterApiKey = async (
  binding: SecretBinding | undefined
): Promise<string | undefined> => {
  if (binding === undefined) {
    return undefined;
  }

  const raw =
    typeof binding === 'string' ? binding : await binding.get().catch(() => '');
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
