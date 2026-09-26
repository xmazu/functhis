import { describe, expect, test } from 'bun:test';

import { QueryClient } from '@tanstack/react-query';

import { runOptimistic } from './optimistic';

describe('runOptimistic', () => {
  test('rolls back cache on mutation failure', async () => {
    const queryClient = new QueryClient();
    const key = ['item', '1'];
    queryClient.setQueryData(key, { count: 1 });

    await expect(
      runOptimistic(
        queryClient,
        [
          {
            queryKey: key,
            updater: () => ({ count: 99 }),
          },
        ],
        () => Promise.reject(new Error('fail'))
      )
    ).rejects.toThrow('fail');

    expect(queryClient.getQueryData<{ count: number }>(key)).toEqual({
      count: 1,
    });
  });

  test('skips invalidation when invalidateOnSuccess is false', async () => {
    const queryClient = new QueryClient();
    const key = ['item', '2'];
    queryClient.setQueryData(key, { count: 1 });
    const invalidate = queryClient.invalidateQueries.bind(queryClient);
    let invalidateCalls = 0;
    queryClient.invalidateQueries = ((opts) => {
      invalidateCalls += 1;
      return invalidate(opts);
    }) as typeof queryClient.invalidateQueries;

    await runOptimistic(
      queryClient,
      [
        {
          queryKey: key,
          updater: () => ({ count: 2 }),
        },
      ],
      () => Promise.resolve('ok'),
      { invalidateOnSuccess: false }
    );

    expect(invalidateCalls).toBe(0);
    expect(queryClient.getQueryData<{ count: number }>(key)).toEqual({
      count: 2,
    });
  });
});
