import { describe, expect, test } from 'bun:test';

import { withTimeout } from './search-budget';

describe('withTimeout', () => {
  test('returns resolved work when it finishes inside the budget', async () => {
    await expect(
      withTimeout(Promise.resolve('ok'), 50, 'fallback')
    ).resolves.toBe('ok');
  });

  test('returns the fallback when work exceeds the budget', async () => {
    await expect(
      withTimeout(
        Bun.sleep(40).then(() => 'late'),
        5,
        'fallback'
      )
    ).resolves.toBe('fallback');
  });
});
