import { describe, expect, test } from 'bun:test';

import { resolvePackageSlug } from './publish';

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

  test('throws when functhis.name is not a valid slug', () => {
    expect(() =>
      resolvePackageSlug('/tmp/dir', undefined, {
        functhis: { name: 'Invalid_Name' },
        isWorkspaceRoot: false,
        name: 'tools',
        packageJsonPath: '/tmp/dir/package.json',
        packageRoot: '/tmp/dir',
      })
    ).toThrow(/Invalid package slug/u);
  });

  test('falls back to the directory name when the npm name is not a slug', () => {
    expect(
      resolvePackageSlug('/tmp/hello-world', undefined, {
        functhis: {},
        isWorkspaceRoot: false,
        name: 'Hello_World',
        packageJsonPath: '/tmp/hello-world/package.json',
        packageRoot: '/tmp/hello-world',
      })
    ).toBe('hello-world');
  });

  test('uses functhis.name then unscoped npm name', () => {
    expect(
      resolvePackageSlug('/tmp/dir', undefined, {
        functhis: { name: 'tools' },
        isWorkspaceRoot: false,
        name: '@neroli/ignored',
        packageJsonPath: '/tmp/dir/package.json',
        packageRoot: '/tmp/dir',
      })
    ).toBe('tools');
    expect(
      resolvePackageSlug('/tmp/dir', undefined, {
        functhis: {},
        isWorkspaceRoot: false,
        name: '@neroli/tools',
        packageJsonPath: '/tmp/dir/package.json',
        packageRoot: '/tmp/dir',
      })
    ).toBe('tools');
  });
});
