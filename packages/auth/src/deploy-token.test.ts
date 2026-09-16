import { describe, expect, test } from 'bun:test';

import { DEPLOY_API_RESOURCE, parseBearerToken } from './deploy-token';

describe('parseBearerToken', () => {
  test('returns token from Authorization header', () => {
    const request = new Request('https://functhis.now/api/deploy/start', {
      headers: { Authorization: 'Bearer abc.def' },
    });
    expect(parseBearerToken(request)).toBe('abc.def');
  });

  test('returns null when header missing', () => {
    const request = new Request('https://functhis.now/api/deploy/start');
    expect(parseBearerToken(request)).toBeNull();
  });
});

describe('DEPLOY_API_RESOURCE', () => {
  test('matches deploy API audience', () => {
    expect(DEPLOY_API_RESOURCE).toBe('https://functhis.now');
  });
});
