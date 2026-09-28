import type { SearchDomain } from '../catalog/hot-catalog';
import { readCatalogGeneration } from '../federation/catalog-generation';
import { storeSearchEventHot } from './search-analytics';
import {
  indexSearchShouldDeferToFallback,
  loadFallbackDocs,
  refineIndexOutcomeWithJev,
  runSearchFallback,
  toHit,
} from './search-fallback';
import type {
  SearchFunctionsContext,
  SearchFunctionsOptions,
} from './search-fallback';
import { runIndexSearch } from './search-index-path';
import { searchPhrasings } from './search-projection';
import {
  SEARCH_DEFAULT_LIMIT,
  trimSearchResultToBudget,
} from './search-result';
import type { SearchResult, SearchTiming } from './search-result';

export type { SearchDomain } from '../catalog/hot-catalog';
export type { SearchHit, SearchResult } from './search-result';
export type {
  SearchFunctionsContext,
  SearchFunctionsOptions,
  SearchRerankCard,
  SearchRerankScorer,
} from './search-fallback';

export const normalizeSearchDomain = (domain?: SearchDomain): SearchDomain =>
  domain ?? 'mine';

const emptyTiming = (): SearchTiming => ({
  indexMs: 0,
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
});

const runEmptyQuerySearch = async (
  hot: SearchFunctionsContext['hot'],
  domain: SearchDomain,
  callerUserId: string,
  timing: SearchTiming
): Promise<{
  organizationId: string | null;
  results: ReturnType<typeof toHit>[];
}> => {
  const loadStarted = Date.now();
  const loaded = await loadFallbackDocs(hot, domain, callerUserId);
  timing.loadMs = Date.now() - loadStarted;
  return {
    organizationId: loaded.docs[0]?.organizationId ?? null,
    results: loaded.docs
      .slice(0, SEARCH_DEFAULT_LIMIT)
      .map((doc) => toHit(doc)),
  };
};

const runFallbackSearch = async (
  context: SearchFunctionsContext,
  domain: SearchDomain,
  callerUserId: string,
  query: {
    phrasings: string[];
    primaryQuery: string;
    started: number;
    timing: SearchTiming;
  },
  options?: SearchFunctionsOptions
): Promise<{
  organizationId: string | null;
  outcome: Awaited<ReturnType<typeof runSearchFallback>>;
}> => {
  const loadStarted = Date.now();
  const loaded = await loadFallbackDocs(context.hot, domain, callerUserId);
  query.timing.loadMs = Date.now() - loadStarted;
  const outcome = await runSearchFallback(
    context,
    {
      callerUserId,
      docs: loaded.docs,
      docsById: loaded.docsById,
      phrasings: query.phrasings,
      primaryQuery: query.primaryQuery,
      started: query.started,
      timing: query.timing,
    },
    options
  );
  return {
    organizationId: loaded.docs[0]?.organizationId ?? null,
    outcome,
  };
};

export const searchFunctionsWithContext = async (
  context: SearchFunctionsContext,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    intents?: readonly string[];
    query?: string;
  },
  options?: SearchFunctionsOptions
): Promise<SearchResult> => {
  const started = Date.now();
  const timing = emptyTiming();
  const domain = normalizeSearchDomain(input.domain);
  const trimmedQuery = input.query?.trim() ?? '';
  const hasIntentInput =
    input.intents?.some((intent) => intent.trim().length > 0) ?? false;
  const phrasings = searchPhrasings(trimmedQuery, input.intents);
  const primaryQuery = phrasings[0] ?? '';
  const searchId = crypto.randomUUID();
  const { hot } = context;

  let analyticsOrganizationId: string | null = null;
  let analyticsGeneration = 0;

  const finish = async (
    result: Omit<SearchResult, 'searchId' | 'timing'> & {
      timing?: SearchTiming;
    }
  ): Promise<SearchResult> => {
    timing.totalMs = Date.now() - started;
    const payload: SearchResult = trimSearchResultToBudget({
      ...result,
      searchId,
      timing: result.timing ?? timing,
    });
    if (analyticsOrganizationId && trimmedQuery.length > 0) {
      await storeSearchEventHot({
        callerUserId: input.callerUserId,
        catalogGeneration: analyticsGeneration,
        explanation: payload.explanation,
        hot,
        organizationId: analyticsOrganizationId,
        query: trimmedQuery,
        searchId,
      });
    }
    return payload;
  };

  if (trimmedQuery.length === 0 && !hasIntentInput) {
    const empty = await runEmptyQuerySearch(
      hot,
      domain,
      input.callerUserId,
      timing
    );
    analyticsOrganizationId = empty.organizationId;
    if (analyticsOrganizationId) {
      analyticsGeneration = await readCatalogGeneration(
        hot,
        analyticsOrganizationId
      );
    }
    return finish({
      ambiguous: false,
      explanation: empty.results.map((hit) => ({
        fusedScore: 0,
        graphBonus: 0,
        id: hit.id,
        usageBoost: 0,
      })),
      reason: empty.results.length === 0 ? 'no_match' : 'ok',
      results: empty.results,
    });
  }

  if (phrasings.length === 0) {
    return finish({
      ambiguous: false,
      explanation: [],
      reason: 'no_match',
      results: [],
    });
  }

  const indexStarted = Date.now();
  try {
    const indexed = await runIndexSearch(hot, domain, input.callerUserId, {
      intents: input.intents,
      primaryQuery,
      query: trimmedQuery,
    });
    timing.indexMs = Date.now() - indexStarted;
    if (indexed) {
      const indexTopId = indexed.result.results[0]?.id;
      const deferToFallback =
        indexTopId &&
        (await indexSearchShouldDeferToFallback(context, {
          callerUserId: input.callerUserId,
          domain,
          indexTopId,
          phrasings,
          primaryQuery,
          timing,
        }));
      if (!deferToFallback) {
        const refined = await refineIndexOutcomeWithJev(context, options, {
          outcome: indexed.result,
          primaryQuery,
          started,
          timing,
        });
        analyticsOrganizationId = indexed.organizationId;
        analyticsGeneration = indexed.generation;
        return finish(refined);
      }
    }
  } catch (error) {
    timing.indexMs = Date.now() - indexStarted;
    context.onIndexSearchError?.(error);
  }

  const fallback = await runFallbackSearch(
    context,
    domain,
    input.callerUserId,
    { phrasings, primaryQuery, started, timing },
    options
  );
  analyticsOrganizationId = fallback.organizationId;
  if (analyticsOrganizationId) {
    analyticsGeneration = await readCatalogGeneration(
      hot,
      analyticsOrganizationId
    );
  }
  return finish(fallback.outcome);
};
