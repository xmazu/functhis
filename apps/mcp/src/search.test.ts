import { describe, expect, test } from 'bun:test';

import { normalizeSearchDomain } from './search';

describe('normalizeSearchDomain', () => {
  test('defaults to mine', () => {
    expect(normalizeSearchDomain()).toBe('mine');
    expect(normalizeSearchDomain('mine')).toBe('mine');
  });

  test('accepts org and library', () => {
    expect(normalizeSearchDomain('org')).toBe('org');
    expect(normalizeSearchDomain('library')).toBe('library');
  });
});
