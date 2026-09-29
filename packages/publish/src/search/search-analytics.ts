import type { Database } from '@functhis/db';
import { searchEvent, searchExposure } from '@functhis/db/schema/catalog';
import { eq } from 'drizzle-orm';

import { sha256Hex } from '../bundle';
import type { HotFunctionDoc, SearchDomain } from '../catalog/hot-catalog';
import type { HotKvBinding } from '../http/http-context';
import type { SearchExplanationRow } from './search-result';

const searchEventHotKey = (searchId: string): string =>
  `searchevt:v1:${searchId}`;

export const hashSearchQuery = (query: string): Promise<string> =>
  sha256Hex(query.trim().toLowerCase());

/** Org id for search_event when scope is unambiguous; null skips HOT analytics write. */
export const resolveSearchEventOrganizationId = (
  domain: SearchDomain,
  docs: readonly HotFunctionDoc[],
  membershipOrganizationIds: readonly string[]
): string | null => {
  if (domain === 'library') {
    return null;
  }
  if (domain === 'org' && membershipOrganizationIds.length === 1) {
    return membershipOrganizationIds[0] ?? null;
  }
  const organizationIds = [
    ...new Set(
      docs
        .map((doc) => doc.organizationId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  if (organizationIds.length === 1) {
    return organizationIds[0] ?? null;
  }
  return null;
};

export interface StoredSearchEvent {
  callerUserId: string;
  catalogGeneration: number;
  explanation: SearchExplanationRow[];
  organizationId: string;
  queryHash: string;
  searchId: string;
}

export const storeSearchEventHot = async (input: {
  callerUserId: string;
  catalogGeneration: number;
  explanation: readonly SearchExplanationRow[];
  hot: HotKvBinding;
  organizationId: string;
  query: string;
  searchId: string;
}): Promise<void> => {
  const event: StoredSearchEvent = {
    callerUserId: input.callerUserId,
    catalogGeneration: input.catalogGeneration,
    explanation: [...input.explanation],
    organizationId: input.organizationId,
    queryHash: await hashSearchQuery(input.query),
    searchId: input.searchId,
  };
  await input.hot.put(
    searchEventHotKey(input.searchId),
    JSON.stringify(event),
    {
      expirationTtl: 60 * 60 * 24 * 14,
    }
  );
};

export const readSearchEventHot = async (
  hot: HotKvBinding,
  searchId: string
): Promise<StoredSearchEvent | null> => {
  const raw = await hot.get(searchEventHotKey(searchId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSearchEvent;
  } catch {
    return null;
  }
};

export const persistSearchSelection = async (input: {
  capabilityId: string;
  database: Database;
  hot: HotKvBinding;
  outcome: 'failed' | 'succeeded' | 'unavailable';
  searchId: string;
}): Promise<void> => {
  const stored = await readSearchEventHot(input.hot, input.searchId);
  if (!stored) {
    return;
  }
  await input.database
    .insert(searchEvent)
    .values({
      callerUserId: stored.callerUserId,
      catalogGeneration: stored.catalogGeneration,
      executionOutcome: input.outcome,
      id: stored.searchId,
      organizationId: stored.organizationId,
      queryHash: stored.queryHash,
      selectedCapabilityId: input.capabilityId,
    })
    .onConflictDoUpdate({
      set: {
        executionOutcome: input.outcome,
        selectedCapabilityId: input.capabilityId,
      },
      target: [searchEvent.id],
    });
  const existing = await input.database
    .select({ id: searchExposure.id })
    .from(searchExposure)
    .where(eq(searchExposure.searchEventId, stored.searchId))
    .limit(1);
  if (existing.length === 0 && stored.explanation.length > 0) {
    await input.database.insert(searchExposure).values(
      stored.explanation.map((row, index) => ({
        capabilityId: row.id,
        exactChannel: row.exactRank !== undefined,
        graphChannel: false,
        lexicalChannel: row.lexicalRank !== undefined,
        position: index + 1,
        searchEventId: stored.searchId,
        vectorChannel: row.vectorRank !== undefined,
      }))
    );
  }
};
