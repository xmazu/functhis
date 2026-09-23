import { describe, expect, test } from 'bun:test';

import { hashSourceTree, sha256Hex, stableBundlePayload } from './bundle';

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

describe('hashSourceTree', () => {
  test('hashes files in sorted path order', async () => {
    const first = await hashSourceTree({ 'a.ts': 'a', 'b.ts': 'b' });
    const second = await hashSourceTree({ 'a.ts': 'a', 'b.ts': 'b' });
    expect(first).toBe(second);
    expect(first).toMatch(/^[\da-f]{64}$/u);
  });
});
