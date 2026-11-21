import { describe, expect, test } from 'bun:test';

import {
  publishFinalizeBodySchema,
  publishFinalizeResponseSchema,
  publishRollbackBodySchema,
  publishStartBodySchema,
  isValidPackageSlug,
} from './schemas';

describe('publishFinalizeResponseSchema', () => {
  test('accepts a complete finalize payload', () => {
    const parsed = publishFinalizeResponseSchema.safeParse({
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

describe('publishStartBodySchema', () => {
  test('requires a slug and at least one file', () => {
    expect(publishStartBodySchema.safeParse({}).success).toBe(false);
    expect(
      publishStartBodySchema.safeParse({
        filesManifest: [{ bytes: 1, path: 'hello.ts' }],
        slug: 'hello-world',
      }).success
    ).toBe(true);
  });
});

describe('publishFinalizeBodySchema', () => {
  test('requires artifact hashes and contracts', () => {
    const parsed = publishFinalizeBodySchema.safeParse({
      artifact: {
        buildJson: '{}',
        bundle: 'export default {}',
        manifestJson: '{}',
        sourceMap: '',
      },
      bundle: {
        mainModule: 'main.js',
        modules: { 'main.js': 'export default {}' },
      },
      bundleHash: 'abc12345',
      contentHash: 'abcdef0123456789',
      contracts: [
        {
          contract: { description: 'hello' },
          exportName: 'default',
          path: 'hello.ts',
          slug: 'hello',
        },
      ],
      gitDirty: true,
      gitSha: 'deadbeef',
      packageId: 'pkg_1',
      sourceHash: 'abcdef0',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('publishRollbackBodySchema', () => {
  test('requires a packageId or slug with a semver', () => {
    expect(
      publishRollbackBodySchema.safeParse({ semver: '1.0.0' }).success
    ).toBe(false);
    expect(
      publishRollbackBodySchema.safeParse({
        semver: '1.0.0',
        slug: 'hello-world',
      }).success
    ).toBe(true);
    expect(
      publishRollbackBodySchema.safeParse({
        packageId: 'pkg_1',
        semver: '1.0.0',
      }).success
    ).toBe(true);
  });
});
