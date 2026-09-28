import type { ParsedFunctionId } from './function-id';
import { formatFunctionId } from './function-id';

export const HOT_FN_PREFIX = 'fn:v1:';
export const HOT_MEMBER_PREFIX = 'member:v1:';
export const HOT_JWKS_KEY = 'jwks:v1';
export const HOT_IDX_LIBRARY_KEY = 'idx:v1:library';
export const HOT_IDX_MINE_PREFIX = 'idx:v1:mine:';
export const HOT_IDX_ORG_PREFIX = 'idx:v1:org:';
export const HOT_TOMBSTONE_TTL_SECONDS = 60;

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

export const HOT_GEN_PREFIX = 'gen:v1:';
export const HOT_ADJ_PREFIX = 'adj:v1:';
export const HOT_EMBED_FP_PREFIX = 'embedfp:v1:';
export const HOT_DEBT_PREFIX = 'debt:v1:';
export const HOT_DEBT_PENDING_KEY = 'debt:v1:pending';
export const HOT_BOOST_PREFIX = 'boost:v1:';
export const HOT_MCP_SNAP_PREFIX = 'mcpsnap:v1:';

export const catalogGenerationHotKey = (organizationId: string): string =>
  `${HOT_GEN_PREFIX}${organizationId}`;

export const adjacencyHotKey = (capabilityId: string): string =>
  `${HOT_ADJ_PREFIX}${capabilityId}`;

export const embedFingerprintHotKey = (capabilityId: string): string =>
  `${HOT_EMBED_FP_PREFIX}${capabilityId}`;

export const searchIndexDebtHotKey = (capabilityId: string): string =>
  `${HOT_DEBT_PREFIX}${capabilityId}`;

export const rankingBoostHotKey = (organizationId: string): string =>
  `${HOT_BOOST_PREFIX}${organizationId}`;

export const mcpSnapshotHotKey = (sourceId: string): string =>
  `${HOT_MCP_SNAP_PREFIX}${sourceId}`;
