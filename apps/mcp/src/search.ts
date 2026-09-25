import { createDb } from '@functhis/db';
import type { Database } from '@functhis/db';
import { formatFunctionId } from '@functhis/publish/function-id';
import {
  buildAccessContextFromHot,
  filterDocsByAccess,
  loadHotFunctionDocsByIds,
  loadSearchFunctionIds,
} from '@functhis/publish/hot-catalog';
import type { SearchDomain } from '@functhis/publish/hot-catalog';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import type { HotKvBinding } from '@functhis/publish/http-context';
import { scoreFunctionDocument } from '@functhis/publish/search-lexical';

import { resolveOpenRouterApiKey } from './openrouter-api-key';
import { createJevSearchRerankScorer } from './search-jev-rerank';
import {
  isExactSearchMatch,
  SEARCH_LIMIT,
  shouldRerankSearch,
  sortSearchCandidates,
} from './search-ranking';
import { applyAiRerankToSorted } from './search-rerank';
import type { SearchRerankScorer } from './search-rerank';

export type { SearchDomain } from '@functhis/publish/hot-catalog';

export interface SearchHit {
  contract: unknown;
  id: string;
}

export const normalizeSearchDomain = (domain?: SearchDomain): SearchDomain =>
  domain ?? 'mine';

const toSearchHit = (row: {
  contract: unknown;
  functionSlug: string;
  handle: string;
  packageSlug: string;
}): SearchHit => ({
  contract: row.contract,
  id: formatFunctionId({
    functionSlug: row.functionSlug,
    handle: row.handle,
    packageSlug: row.packageSlug,
  }),
});

export interface SearchFunctionsContext {
  database: Database;
  hot: HotKvBinding;
  openRouterApiKey?: string;
}

export interface SearchFunctionsOptions {
  /** Integration tests and callers that mock Jev without OpenRouter. */
  rerankScorer?: SearchRerankScorer;
}

export const searchFunctionsWithContext = async (
  context: SearchFunctionsContext,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  },
  options?: SearchFunctionsOptions
): Promise<SearchHit[]> => {
  const domain = normalizeSearchDomain(input.domain);
  const trimmedQuery = input.query?.trim() ?? '';

  const [functionIds, accessContext] = await Promise.all([
    loadSearchFunctionIds(
      context.hot,
      context.database,
      domain,
      input.callerUserId
    ),
    buildAccessContextFromHot(
      context.hot,
      context.database,
      input.callerUserId
    ),
  ]);

  const docs = filterDocsByAccess(
    await loadHotFunctionDocsByIds(context.hot, context.database, functionIds),
    accessContext
  );

  if (trimmedQuery.length === 0) {
    return docs.slice(0, SEARCH_LIMIT).map((doc) =>
      toSearchHit({
        contract: doc.contract,
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      })
    );
  }

  const candidates = docs.map((doc) => {
    const id = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const lexicalScore = scoreFunctionDocument(trimmedQuery, {
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      id,
      packageSlug: doc.packageSlug,
      searchText: doc.searchText,
    });
    return {
      contract: doc.contract,
      exactMatch: isExactSearchMatch(trimmedQuery, doc),
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      id,
      lexicalScore,
      packageSlug: doc.packageSlug,
      searchText: doc.searchText,
    };
  });

  const filtered = candidates.filter(
    (row) => row.exactMatch || row.lexicalScore > 0
  );
  let sorted = sortSearchCandidates(filtered);
  const rerankDecision = shouldRerankSearch(sorted);
  if (rerankDecision.rerank) {
    const scorer =
      options?.rerankScorer ??
      createJevSearchRerankScorer(context.openRouterApiKey);
    sorted = await applyAiRerankToSorted(trimmedQuery, sorted, scorer);
  }

  return sorted.slice(0, SEARCH_LIMIT).map((row) => toSearchHit(row));
};

export const searchFunctions = async (
  env: Env,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  },
  options?: SearchFunctionsOptions
): Promise<SearchHit[]> => {
  const hot = asHotKvBinding(env.HOT);
  const database = await createDb(env);
  const openRouterApiKey = await resolveOpenRouterApiKey(
    env.OPENROUTER_API_KEY
  );
  return searchFunctionsWithContext(
    { database, hot, openRouterApiKey },
    input,
    options
  );
};
