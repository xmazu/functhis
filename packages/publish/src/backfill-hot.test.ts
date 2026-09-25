import { describe, expect, mock, test } from 'bun:test';

import type { Database } from '@functhis/db';

import { backfillHotCatalog } from './backfill-hot';
import type { HotKvBinding } from './http-context';

const hot: HotKvBinding = {
  delete: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
};

const createDatabase = (rows: { id: string | null | undefined }[]) =>
  ({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  }) as unknown as Database;

describe('backfillHotCatalog', () => {
  test('syncs every package id with a current version', async () => {
    const syncPackage = mock((_hot: HotKvBinding, _db: Database, _id: string) =>
      Promise.resolve()
    );
    const database = createDatabase([{ id: 'pkg-1' }, { id: 'pkg-2' }]);

    const result = await backfillHotCatalog(hot, database, { syncPackage });

    expect(result).toEqual({ packagesSynced: 2 });
    expect(syncPackage).toHaveBeenCalledTimes(2);
    expect(syncPackage).toHaveBeenCalledWith(hot, database, 'pkg-1');
    expect(syncPackage).toHaveBeenCalledWith(hot, database, 'pkg-2');
  });

  test('drops empty ids and returns zero when there is nothing to sync', async () => {
    const syncPackage = mock(() => Promise.resolve());
    const database = createDatabase([
      { id: null },
      { id: undefined },
      { id: '' },
    ]);

    const result = await backfillHotCatalog(hot, database, { syncPackage });

    expect(result).toEqual({ packagesSynced: 0 });
    expect(syncPackage).not.toHaveBeenCalled();
  });
});
