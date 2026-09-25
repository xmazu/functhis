import type { ParsedFunctionId } from './function-id';
import { formatFunctionId } from './function-id';

export const HOT_FN_PREFIX = 'fn:v1:';
export const HOT_MEMBER_PREFIX = 'member:v1:';
export const HOT_JWKS_KEY = 'jwks:v1';
export const HOT_IDX_LIBRARY_KEY = 'idx:v1:library';
export const HOT_IDX_MINE_PREFIX = 'idx:v1:mine:';
export const HOT_IDX_ORG_PREFIX = 'idx:v1:org:';

export const functionHotKey = (parsed: ParsedFunctionId): string =>
  `${HOT_FN_PREFIX}${formatFunctionId(parsed)}`;

export const functionHotKeyFromId = (id: string): string =>
  id.startsWith(HOT_FN_PREFIX) ? id : `${HOT_FN_PREFIX}${id}`;

export const memberHotKey = (userId: string): string =>
  `${HOT_MEMBER_PREFIX}${userId}`;

export const mineIndexHotKey = (userId: string): string =>
  `${HOT_IDX_MINE_PREFIX}${userId}`;

export const orgIndexHotKey = (organizationId: string): string =>
  `${HOT_IDX_ORG_PREFIX}${organizationId}`;

export const HOT_TOMBSTONE_TTL_SECONDS = 60;
