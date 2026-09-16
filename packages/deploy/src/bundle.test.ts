import { describe, expect, test } from 'bun:test';

import { sha256Hex, stableBundlePayload } from './bundle';

describe('stableBundlePayload', () => {
  test('sorts module keys for deterministic hashing', async () => {
    const bundle = {
      mainModule: 'bootstrap.js',
      modules: {
        'a.js': 'a',
        'b.js': 'b',
      },
    };
    const payload = stableBundlePayload(bundle);
    expect(payload).toBe(
      '{"mainModule":"bootstrap.js","modules":{"a.js":"a","b.js":"b"}}'
    );
    const hash = await sha256Hex(payload);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(
      await sha256Hex(
        stableBundlePayload({
          mainModule: 'bootstrap.js',
          modules: { 'a.js': 'a', 'b.js': 'b' },
        })
      )
    );
  });
});
