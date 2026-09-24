import { describe, expect, test } from 'bun:test';

import { matchPublicPath } from './routing';

describe('matchPublicPath', () => {
  test('parses package path', () => {
    expect(matchPublicPath('/@alice/demo')).toEqual({
      handle: 'alice',
      packageSlug: 'demo',
    });
  });

  test('parses function path with namespace', () => {
    expect(matchPublicPath('/@alice/demo/billing/send')).toEqual({
      functionSlug: 'billing/send',
      handle: 'alice',
      packageSlug: 'demo',
    });
  });
});
