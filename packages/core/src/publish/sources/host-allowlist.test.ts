import { describe, expect, test } from 'bun:test';

import {
  assertHostAllowedForFetch,
  hostAllowedForFetch,
} from './host-allowlist';

describe('host allowlist', () => {
  test('unrestricted when the list is absent', () => {
    expect(hostAllowedForFetch('https://api.example.com')).toBe(true);
  });

  test('empty list blocks every host', () => {
    expect(hostAllowedForFetch('https://api.example.com', [])).toBe(false);
  });

  test('matches hostname case-insensitively', () => {
    expect(
      hostAllowedForFetch('https://API.example.com/v1', ['api.example.com'])
    ).toBe(true);
    expect(
      hostAllowedForFetch('https://other.example.com', ['api.example.com'])
    ).toBe(false);
  });

  test('throws for a blocked host', () => {
    expect(() =>
      assertHostAllowedForFetch('https://evil.test', ['api.example.com'])
    ).toThrow(/allowlist/u);
  });
});
