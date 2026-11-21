import type { SearchDomain } from '../catalog/hot-catalog';
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
  const { hot } = context;

  const finish = (
    result: Omit<SearchResult, 'timing'> & { timing?: SearchTiming }
  ): SearchResult => {
    timing.totalMs = Date.now() - started;
    return trimSearchResultToBudget({
      ...result,
      timing: result.timing ?? timing,
    });
  };

  if (trimmedQuery.length === 0 && !hasIntentInput) {
    const loadStarted = Date.now();
    const loaded = await loadSearchDocs(hot, domain, input.callerUserId);
    timing.loadMs = Date.now() - loadStarted;
    const results = loaded.docs
      .slice(0, SEARCH_DEFAULT_LIMIT)
      .map((doc) => toHit(doc));
    return finish({
      ambiguous: false,
      reason: results.length === 0 ? 'no_match' : 'ok',
      results,
    });
  }

  if (phrasings.length === 0) {
    return finish({
      ambiguous: false,
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
  return finish(outcome);
};
