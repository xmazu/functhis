import { describe, expect, test } from 'bun:test';

import { assertSearchDomain, UnsupportedSearchDomainError } from './search';

describe('assertSearchDomain', () => {
  test('accepts mine and undefined', () => {
    expect(assertSearchDomain()).toBe('mine');
    expect(assertSearchDomain('mine')).toBe('mine');
  });

  test('rejects unsupported domains', () => {
    expect(() => assertSearchDomain('org')).toThrow(
      UnsupportedSearchDomainError
    );
    expect(() => assertSearchDomain('library')).toThrow(
      UnsupportedSearchDomainError
    );
  });
});
