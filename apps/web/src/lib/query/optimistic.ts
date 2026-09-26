import type { QueryClient, QueryKey } from '@tanstack/react-query';

interface CachePatch<TData> {
  queryKey: QueryKey;
  updater: (previous: TData | undefined) => TData | undefined;
}

interface Snapshot {
  queryKey: QueryKey;
  previous: unknown;
}

/**
 * Apply in-memory cache patches, run the mutation, roll back on failure.
 * Optionally invalidate listed keys on success (default: the patched keys).
 */
export const runOptimistic = async <TResult>(
  queryClient: QueryClient,
  patches: CachePatch<unknown>[],
  mutation: () => Promise<TResult>,
  options?: {
    invalidateKeys?: QueryKey[];
    invalidateOnSuccess?: boolean;
  }
): Promise<TResult> => {
  const snapshots: Snapshot[] = [];

  await Promise.all(
    patches.map((patch) =>
      queryClient.cancelQueries({ queryKey: patch.queryKey })
    )
  );

  for (const patch of patches) {
    const previous = queryClient.getQueryData(patch.queryKey);
    snapshots.push({ previous, queryKey: patch.queryKey });
    queryClient.setQueryData(patch.queryKey, patch.updater(previous));
  }

  try {
    const result = await mutation();
    if (options?.invalidateOnSuccess !== false) {
      const keys = options?.invalidateKeys ?? patches.map((p) => p.queryKey);
      await Promise.all(
        keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
    }
    return result;
  } catch (error) {
    for (const snapshot of snapshots) {
      queryClient.setQueryData(snapshot.queryKey, snapshot.previous);
    }
    throw error;
  }
};

/** Single-key convenience wrapper. */
export const runOptimisticQuery = <TData, TResult>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (previous: TData | undefined) => TData | undefined,
  mutation: () => Promise<TResult>,
  options?: {
    invalidateKeys?: QueryKey[];
    invalidateOnSuccess?: boolean;
  }
): Promise<TResult> =>
  runOptimistic(
    queryClient,
    [
      {
        queryKey,
        updater: updater as (previous: unknown) => unknown,
      },
    ],
    mutation,
    options
  );
