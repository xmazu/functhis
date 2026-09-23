import { describe, expect, test } from 'bun:test';

import { PUBLISH_API_RESOURCE, parseBearerToken } from './publish-token';

describe('parseBearerToken', () => {
  test('returns token from Authorization header', () => {
    const request = new Request('https://functhis.now/api/publish/start', {
      headers: { Authorization: 'Bearer abc.def' },
    });
    expect(parseBearerToken(request)).toBe('abc.def');
  });

  test('returns null when header missing', () => {
    const request = new Request('https://functhis.now/api/publish/start');
    expect(parseBearerToken(request)).toBeNull();
  });
});

describe('PUBLISH_API_RESOURCE', () => {
  test('matches deploy API audience', () => {
    expect(PUBLISH_API_RESOURCE).toBe('https://functhis.now');
  });
});
