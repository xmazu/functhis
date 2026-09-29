import { readCatalogGeneration } from '../catalog/catalog-generation';
import type { SearchDomain } from '../catalog/hot-catalog';
import {
  resolveSearchEventOrganizationId,
  storeSearchEventHot,
} from './search-analytics';
import { loadSearchDocs } from './search-catalog-load';
import { runCatalogSearch } from './search-catalog-pipeline';
import type {
  SearchFunctionsContext,
  SearchFunctionsOptions,
} from './search-context';
import { toHit } from './search-hits';
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
} from './search-context';
export type { SearchRerankCard, SearchRerankScorer } from './search-rerank';

export const normalizeSearchDomain = (domain?: SearchDomain): SearchDomain =>
  domain ?? 'mine';

const emptyTiming = (): SearchTiming => ({
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
  analyticsOrganizationId: string | null;
  results: ReturnType<typeof toHit>[];
}> => {
  const loadStarted = Date.now();
  const loaded = await loadSearchDocs(hot, domain, callerUserId);
  timing.loadMs = Date.now() - loadStarted;
  return {
    analyticsOrganizationId: resolveSearchEventOrganizationId(
      domain,
      loaded.docs,
      loaded.accessContext.organizationIds
    ),
    results: loaded.docs
      .slice(0, SEARCH_DEFAULT_LIMIT)
      .map((doc) => toHit(doc)),
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
    const { analyticsOrganizationId: emptyAnalyticsOrgId, results } = empty;
    analyticsOrganizationId = emptyAnalyticsOrgId;
    if (emptyAnalyticsOrgId) {
      analyticsGeneration = await readCatalogGeneration(
        hot,
        emptyAnalyticsOrgId
      );
    }
    return finish({
      ambiguous: false,
      explanation: results.map((hit) => ({
        fusedScore: 0,
        id: hit.id,
      })),
      reason: results.length === 0 ? 'no_match' : 'ok',
      results,
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

  const loadStarted = Date.now();
  const loaded = await loadSearchDocs(hot, domain, input.callerUserId);
  timing.loadMs = Date.now() - loadStarted;
  const outcome = await runCatalogSearch(
    context,
    {
      callerUserId: input.callerUserId,
      docs: loaded.docs,
      docsById: loaded.docsById,
      phrasings,
      primaryQuery,
      started,
      timing,
    },
    options
  );
  analyticsOrganizationId = resolveSearchEventOrganizationId(
    domain,
    loaded.docs,
    loaded.accessContext.organizationIds
  );
  if (analyticsOrganizationId) {
    analyticsGeneration = await readCatalogGeneration(
      hot,
      analyticsOrganizationId
    );
  }
  return finish(outcome);
};
