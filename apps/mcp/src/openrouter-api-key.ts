export const resolveOpenRouterApiKey = async (
  binding: SecretsStoreSecret | string | undefined
): Promise<string | undefined> => {
  if (binding === undefined) {
    return undefined;
  }

  const raw =
    typeof binding === 'string' ? binding : await binding.get().catch(() => '');
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
