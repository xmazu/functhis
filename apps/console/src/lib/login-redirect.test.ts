import { describe, expect, it } from 'bun:test';

import { callbackURLFromLocation } from './login-redirect';

describe('callbackURLFromLocation', () => {
  it('uses href for path and query', () => {
    expect(
      callbackURLFromLocation({
        href: '/device?user_code=abc',
        pathname: '/device',
      })
    ).toBe('/device?user_code=abc');
  });

  it('does not stringify parsed search objects', () => {
    expect(
      callbackURLFromLocation({
        href: '/',
        pathname: '/',
      })
    ).toBe('/');
  });
});
