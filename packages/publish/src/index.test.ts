import { describe, expect, test } from 'bun:test';

import { CLI_CLIENT_ID, formatFunctionId } from './index';

describe('package exports', () => {
  test('exposes oauth and function id helpers', () => {
    expect(CLI_CLIENT_ID).toBe('functhis-cli');
    expect(
      formatFunctionId({
        functionSlug: 'c',
        handle: 'a',
        packageSlug: 'b',
      })
    ).toBe('@a/b/c');
  });
});
