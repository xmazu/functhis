import { describe, expect, test } from 'bun:test';

import { asHotKvBinding } from './hot-kv-binding';

describe('asHotKvBinding', () => {
  test('forwards get, put, and delete to the underlying kv', async () => {
    const store = new Map<string, string>();
    const kv = {
      delete: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      put: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    };

    const hot = asHotKvBinding(kv);
    await hot.put('k', 'v', { expirationTtl: 60 });
    expect(await hot.get('k')).toBe('v');
    await hot.delete('k');
    expect(await hot.get('k')).toBeNull();
  });
});
