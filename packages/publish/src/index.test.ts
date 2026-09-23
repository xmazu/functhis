import { describe, expect, test } from 'bun:test';

import {
  CLI_CLIENT_ID,
  internalMcpExecuteUrl,
  publicFunctionPath,
  publicPackagePath,
} from './index';

describe('package exports', () => {
  test('exposes oauth, public paths, and internal execute helpers', () => {
    expect(CLI_CLIENT_ID).toBe('functhis-cli');
    expect(publicPackagePath({ handle: 'a', packageSlug: 'b' })).toBe('/@a/b');
    expect(
      publicFunctionPath({
        functionSlug: 'c',
        handle: 'a',
        packageSlug: 'b',
      })
    ).toBe('/@a/b/c');
    expect(internalMcpExecuteUrl).toContain('/internal/execute');
  });
});
