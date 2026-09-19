import { describe, expect, test } from 'bun:test';

import { resolvePackageSlug } from './deploy';

describe('resolvePackageSlug', () => {
  test('uses explicit slug when valid', () => {
    expect(resolvePackageSlug('/tmp/hello-world', 'my-pkg')).toBe('my-pkg');
  });

  test('throws when explicit slug is invalid', () => {
    expect(() =>
      resolvePackageSlug('/tmp/hello-world', 'Invalid_Slug')
    ).toThrow(/Invalid package slug/u);
  });

  test('falls back to package when directory name is invalid', () => {
    expect(resolvePackageSlug('/tmp/HelloWorld')).toBe('package');
  });

  test('uses directory name when valid kebab-case', () => {
    expect(resolvePackageSlug('/tmp/hello-world')).toBe('hello-world');
  });
});
