import { describe, expect, test } from 'bun:test';

import { formatPublishResult } from './publish-output';

describe('formatPublishResult', () => {
  test('includes package URL, function URLs, and MCP ids', () => {
    const lines = formatPublishResult('https://functhis.now', {
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
    expect(lines.some((line) => line.includes('/@xmazu/hello-world'))).toBe(
      true
    );
    expect(
      lines.some((line) => line.includes('/@xmazu/hello-world/hello'))
    ).toBe(true);
    expect(
      lines.some((line) => line.includes('MCP: @xmazu/hello-world/hello'))
    ).toBe(true);
  });
});
