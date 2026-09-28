import { describe, expect, test } from 'bun:test';

import {
  adjacencyHotKey,
  catalogGenerationHotKey,
  embedFingerprintHotKey,
  functionHotKey,
  functionHotKeyFromId,
  HOT_IDX_LIBRARY_KEY,
  HOT_JWKS_KEY,
  memberHotKey,
  mineIndexHotKey,
  mcpSnapshotHotKey,
  orgIndexHotKey,
  rankingBoostHotKey,
  searchIndexDebtHotKey,
} from './hot-keys';

describe('hot-keys', () => {
  test('builds stable v1 key prefixes', () => {
    expect(
      functionHotKey({
        functionSlug: 'hello',
        handle: 'alice',
        packageSlug: 'tools',
      })
    ).toBe('fn:v1:@alice/tools/hello');
    expect(functionHotKeyFromId('@alice/tools/hello')).toBe(
      'fn:v1:@alice/tools/hello'
    );
    expect(mineIndexHotKey('user-1')).toBe('idx:v1:mine:user-1');
    expect(orgIndexHotKey('org-1')).toBe('idx:v1:org:org-1');
    expect(HOT_IDX_LIBRARY_KEY).toBe('idx:v1:library');
    expect(memberHotKey('user-1')).toBe('member:v1:user-1');
    expect(HOT_JWKS_KEY).toBe('jwks:v1');
    expect(catalogGenerationHotKey('org-1')).toBe('gen:v1:org-1');
    expect(adjacencyHotKey('@acme/crm/users/search')).toBe(
      'adj:v1:@acme/crm/users/search'
    );
    expect(embedFingerprintHotKey('@acme/crm/users/search')).toBe(
      'embedfp:v1:@acme/crm/users/search'
    );
    expect(searchIndexDebtHotKey('@acme/crm/users/search')).toBe(
      'debt:v1:@acme/crm/users/search'
    );
    expect(rankingBoostHotKey('org-1')).toBe('boost:v1:org-1');
    expect(mcpSnapshotHotKey('src-1')).toBe('mcpsnap:v1:src-1');
  });
});
