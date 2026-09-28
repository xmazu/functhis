import { HOT_DEBT_PENDING_KEY, searchIndexDebtHotKey } from './hot-keys';
import type { HotKvBinding } from './http-context';

export interface SearchIndexDebt {
  embedText: string;
  generation: number;
  organizationId: string;
}

export const listPendingSearchIndexDebtIds = async (
  hot: HotKvBinding
): Promise<string[]> => {
  const raw = await hot.get(HOT_DEBT_PENDING_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePendingSearchIndexDebtIds = async (
  hot: HotKvBinding,
  ids: readonly string[]
): Promise<void> => {
  await hot.put(HOT_DEBT_PENDING_KEY, JSON.stringify([...new Set(ids)]));
};

export const markSearchIndexDebt = async (input: {
  capabilityId: string;
  embedText: string;
  hot: HotKvBinding;
  organizationId: string;
}): Promise<number> => {
  const key = searchIndexDebtHotKey(input.capabilityId);
  const existingRaw = await input.hot.get(key);
  let generation = 1;
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as SearchIndexDebt;
      generation = existing.generation + 1;
    } catch {
      generation = 1;
    }
  }
  const debt: SearchIndexDebt = {
    embedText: input.embedText,
    generation,
    organizationId: input.organizationId,
  };
  await input.hot.put(key, JSON.stringify(debt));
  const pending = await listPendingSearchIndexDebtIds(input.hot);
  await writePendingSearchIndexDebtIds(input.hot, [
    ...pending,
    input.capabilityId,
  ]);
  return generation;
};

export const readSearchIndexDebt = async (
  hot: HotKvBinding,
  capabilityId: string
): Promise<SearchIndexDebt | null> => {
  const raw = await hot.get(searchIndexDebtHotKey(capabilityId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SearchIndexDebt;
  } catch {
    return null;
  }
};

export const clearSearchIndexDebt = async (input: {
  capabilityId: string;
  generation: number;
  hot: HotKvBinding;
}): Promise<boolean> => {
  const current = await readSearchIndexDebt(input.hot, input.capabilityId);
  if (!current || current.generation !== input.generation) {
    return false;
  }
  await input.hot.delete(searchIndexDebtHotKey(input.capabilityId));
  const pending = await listPendingSearchIndexDebtIds(input.hot);
  await writePendingSearchIndexDebtIds(
    input.hot,
    pending.filter((id) => id !== input.capabilityId)
  );
  return true;
};
