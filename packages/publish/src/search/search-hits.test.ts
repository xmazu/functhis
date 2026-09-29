import { describe, expect, test } from 'bun:test';

import { asSearchContract } from './search-hits';

describe('asSearchContract', () => {
  test('returns null for missing or non-object contracts', () => {
    expect(asSearchContract(null)).toBeNull();
    expect(asSearchContract()).toBeNull();
    expect(asSearchContract('not-json')).toBeNull();
  });

  test('passes through object contracts', () => {
    expect(asSearchContract({ description: 'Find user' })).toEqual({
      description: 'Find user',
    });
  });
});
