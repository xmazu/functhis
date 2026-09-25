import { describe, expect, test } from 'bun:test';

import { HOT_JWKS_KEY } from './hot-keys';
import type { HotKvBinding } from './http-context';
import { resolveJwksVerifier, writeJwksHot } from './jwks-hot';

const memoryHot = (): HotKvBinding => {
  const store = new Map<string, string>();
  return {
    delete: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(store.get(key) ?? null),
    put: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};

describe('jwks-hot', () => {
  test('writeJwksHot stores JSON at the jwks key', async () => {
    const hot = memoryHot();
    await writeJwksHot(hot, { keys: [] });
    expect(await hot.get(HOT_JWKS_KEY)).toBe(JSON.stringify({ keys: [] }));
  });

  test('resolveJwksVerifier fetches and caches when HOT is empty', async () => {
    const hot = memoryHot();
    const jwks = { keys: [] as unknown[] };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(Response.json(jwks, { status: 200 }))) as typeof fetch;

    try {
      const verifier = await resolveJwksVerifier(
        hot,
        'https://example.com/jwks'
      );
      expect(typeof verifier).toBe('function');
      expect(await hot.get(HOT_JWKS_KEY)).toBe(JSON.stringify(jwks));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
