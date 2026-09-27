export interface SecretListItem {
  lastUsedAt: Date | string | null;
  name: string;
  updatedAt: Date | string;
}

export const formatSecretActivityDate = (
  value: Date | string | null | undefined
): string => {
  if (value === null || value === undefined) {
    return 'Never';
  }
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const dayMs = 86_400_000;
  if (diffMs < dayMs) {
    return 'Today';
  }
  if (diffMs < dayMs * 2) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
