import { describe, expect, test } from 'bun:test';

import {
  functionHotKey,
  functionHotKeyFromId,
  HOT_IDX_LIBRARY_KEY,
  HOT_JWKS_KEY,
  memberHotKey,
  mineIndexHotKey,
  orgIndexHotKey,
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
  });
});
