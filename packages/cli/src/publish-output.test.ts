import { describe, expect, test } from 'bun:test';

import { formatPublishResult } from './publish-output';

describe('formatPublishResult', () => {
  test('includes MCP ids', () => {
    const lines = formatPublishResult({
      artifactKey: 'artifacts/sha256/ab/abc',
      bundleHash: 'abc123456789',
      bundleKvKey: 'deadbeef',
      currentVersionId: 'ver_1',
      functions: [{ slug: 'hello' }],
      handle: 'xmazu',
      packageId: 'pkg_1',
      semver: '1.0.0',
      slug: 'hello-world',
      versionId: 'ver_1',
    });

    expect(lines[0]).toBe('Published @xmazu/hello-world@1.0.0');
    expect(lines).toContain('  @xmazu/hello-world/hello');
  });
});
