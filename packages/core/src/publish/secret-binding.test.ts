import { describe, expect, test } from 'bun:test';

import { resolveSecret } from './secret-binding';

describe('resolveSecret', () => {
  test('returns plain strings', async () => {
    await expect(resolveSecret('plain')).resolves.toBe('plain');
  });

  test('calls binding get()', async () => {
    await expect(
      resolveSecret({ get: () => Promise.resolve('from-binding') })
    ).resolves.toBe('from-binding');
  });

  test('rejects invalid bindings', async () => {
    await expect(
      resolveSecret({ get: 'nope' } as unknown as {
        get: () => Promise<string>;
      })
    ).rejects.toThrow(/Invalid secret binding/u);
  });
});
