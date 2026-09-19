import { describe, expect, test } from 'bun:test';

import { deployFinalizeResponseSchema, isValidPackageSlug } from './schemas';

describe('deployFinalizeResponseSchema', () => {
  test('accepts a complete finalize payload', () => {
    const parsed = deployFinalizeResponseSchema.safeParse({
      bundleHash: 'abc123456789',
      bundleKvKey: 'deadbeef',
      currentVersionId: 'ver_1',
      functions: [{ slug: 'hello' }],
      handle: 'xmazu',
      packageId: 'pkg_1',
      slug: 'hello-world',
      versionId: 'ver_1',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('isValidPackageSlug', () => {
  test('accepts kebab-case slugs', () => {
    expect(isValidPackageSlug('hello-world')).toBe(true);
  });

  test('rejects invalid slugs', () => {
    expect(isValidPackageSlug('Hello_World')).toBe(false);
  });
});
