import { describe, expect, test } from 'bun:test';

import { isExactSearchMatch } from './search-exact';

describe('isExactSearchMatch', () => {
  test('matches slug, package, handle, and full id', () => {
    const row = {
      functionSlug: 'users/search',
      handle: 'acme',
      packageSlug: 'crm',
    };
    expect(isExactSearchMatch('users/search', row)).toBe(true);
    expect(isExactSearchMatch('crm', row)).toBe(true);
    expect(isExactSearchMatch('acme', row)).toBe(true);
    expect(isExactSearchMatch('@acme/crm/users/search', row)).toBe(true);
    expect(isExactSearchMatch('email', row)).toBe(false);
  });

  test('detects exact handle and package slug alone', () => {
    expect(
      isExactSearchMatch('hello', {
        functionSlug: 'hello',
        handle: 'alice',
        packageSlug: 'pkg',
      })
    ).toBe(true);
    expect(
      isExactSearchMatch('pkg', {
        functionSlug: 'hello',
        handle: 'alice',
        packageSlug: 'pkg',
      })
    ).toBe(true);
  });
});
