import { describe, expect, test } from 'bun:test';

import { resolvePackagePublicHandle } from './package-public-handle';

describe('resolvePackagePublicHandle', () => {
  test('returns null when package has no organization', async () => {
    await expect(resolvePackagePublicHandle({} as never, null)).resolves.toBe(
      null
    );
  });

  test('delegates to organization slug lookup', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ slug: 'weselnemomenty' }]),
          }),
        }),
      }),
    };

    await expect(
      resolvePackagePublicHandle(database as never, 'org-1')
    ).resolves.toBe('weselnemomenty');
  });
});
