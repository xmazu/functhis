import type { Database } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { eq } from 'drizzle-orm';

const HANDLE_MAX_LENGTH = 39;
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const AT_PREFIX_PATTERN = /^@+/u;
const INVALID_CHAR_PATTERN = /[^a-z0-9-]+/gu;
const HYPHEN_RUN_PATTERN = /-+/gu;
const EDGE_HYPHEN_PATTERN = /^-+|-+$/gu;

export const normalizeHandleCandidate = (raw: string): string => {
  const lowered = raw.trim().toLowerCase();
  const stripped = lowered.replace(AT_PREFIX_PATTERN, '');
  const sanitized = stripped
    .replace(INVALID_CHAR_PATTERN, '-')
    .replace(HYPHEN_RUN_PATTERN, '-')
    .replace(EDGE_HYPHEN_PATTERN, '');

  if (sanitized.length === 0) {
    return 'user';
  }

  const truncated = sanitized.slice(0, HANDLE_MAX_LENGTH);
  if (truncated.length === 1) {
    return truncated;
  }

  return truncated.replace(EDGE_HYPHEN_PATTERN, '') || 'user';
};

export const isValidHandle = (handle: string): boolean =>
  handle.length >= 1 &&
  handle.length <= HANDLE_MAX_LENGTH &&
  HANDLE_PATTERN.test(handle);

const handleExists = async (
  database: Database,
  handle: string
): Promise<boolean> => {
  const rows = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.handle, handle))
    .limit(1);

  return rows.length > 0;
};

const buildSuffixedHandle = (base: string, suffix: number): string => {
  const suffixText = `-${suffix}`;
  const maxBaseLength = HANDLE_MAX_LENGTH - suffixText.length;
  const truncatedBase = base.slice(0, Math.max(1, maxBaseLength));
  return `${truncatedBase}${suffixText}`;
};

const allocateWithSuffix = async (
  database: Database,
  base: string,
  suffix: number
): Promise<string> => {
  const candidate = suffix === 0 ? base : buildSuffixedHandle(base, suffix);
  if (!(await handleExists(database, candidate))) {
    return candidate;
  }

  if (suffix >= 9999) {
    throw new Error('Unable to allocate a unique handle');
  }

  return allocateWithSuffix(database, base, suffix === 0 ? 2 : suffix + 1);
};

export const allocateUniqueHandle = (
  database: Database,
  preferred: string
): Promise<string> => {
  const base = normalizeHandleCandidate(preferred);
  if (!isValidHandle(base)) {
    return Promise.reject(new Error(`Invalid handle candidate: ${preferred}`));
  }

  return allocateWithSuffix(database, base, 0);
};
