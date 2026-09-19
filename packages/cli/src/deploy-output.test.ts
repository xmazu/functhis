import { describe, expect, test } from 'bun:test';

import { formatDeployResult } from './deploy-output';

describe('formatDeployResult', () => {
  test('includes package URL, function URLs, and MCP ids', () => {
    const lines = formatDeployResult('https://functhis.now', {
      bundleHash: 'abc123456789',
      bundleKvKey: 'deadbeef',
      currentVersionId: 'ver_1',
      functions: [{ slug: 'hello' }],
      handle: 'xmazu',
      packageId: 'pkg_1',
      slug: 'hello-world',
      versionId: 'ver_1',
    });

    expect(lines[0]).toBe('Deployed @xmazu/hello-world');
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
