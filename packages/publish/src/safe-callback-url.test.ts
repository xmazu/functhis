import { describe, expect, test } from 'bun:test';

import {
  safeCallbackURL,
  safeCallbackURLFromRequest,
} from './safe-callback-url';

describe('safeCallbackURL', () => {
  test('allows same-origin relative paths', () => {
    expect(safeCallbackURL('/packages')).toBe('/packages');
    expect(safeCallbackURL('/accept-invitation/abc')).toBe(
      '/accept-invitation/abc'
    );
  });

  test('rejects open redirects', () => {
    expect(safeCallbackURL('https://evil.test')).toBe('/');
    expect(safeCallbackURL('//evil.test/path')).toBe('/');
    expect(safeCallbackURL(`${'javascript'}:alert(1)`)).toBe('/');
  });

  test('falls back for non-strings', () => {
    expect(safeCallbackURL()).toBe('/');
    expect(safeCallbackURL(null)).toBe('/');
  });
});

describe('safeCallbackURLFromRequest', () => {
  test('uses pathname and search only', () => {
    expect(
      safeCallbackURLFromRequest('https://functhis.now/@alice/pkg/fn?q=1')
    ).toBe('/@alice/pkg/fn?q=1');
  });

  test('falls back when the request URL is invalid', () => {
    expect(safeCallbackURLFromRequest('not-a-url')).toBe('/');
  });
});
