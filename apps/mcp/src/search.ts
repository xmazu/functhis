import { embedTexts, isEmbeddingOffline } from '@functhis/publish/embedding';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { searchFunctionsWithContext } from '@functhis/publish/search-run';
import type {
  SearchDomain,
  SearchFunctionsOptions,
  SearchResult,
} from '@functhis/publish/search-run';
import { VectorizeEmbeddingIndex } from '@functhis/publish/vectorize-index';

import { resolveOpenRouterApiKey } from './openrouter-api-key';
import { createJevSearchRerankScorer } from './search-jev-rerank';

export interface SearchFunctionsDependencies {
  embedTexts?: typeof embedTexts;
  isEmbeddingOffline?: typeof isEmbeddingOffline;
  resolveOpenRouterApiKey?: typeof resolveOpenRouterApiKey;
  searchFunctionsWithContext?: typeof searchFunctionsWithContext;
  vectorIndexFactory?: (
    binding: NonNullable<Env['CAPABILITY_VECTOR_INDEX']>
  ) => VectorizeEmbeddingIndex;
}

export type { SearchDomain } from '@functhis/publish/search-run';
export type { SearchHit, SearchResult } from '@functhis/publish/search-run';
export {
  normalizeSearchDomain,
  searchFunctionsWithContext,
} from '@functhis/publish/search-run';

export const searchFunctions = async (
  env: Env,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  },
  options?: SearchFunctionsOptions,
  dependencies: SearchFunctionsDependencies = {}
): Promise<SearchResult> => {
  const hot = asHotKvBinding(env.HOT);
  const resolveKey =
    dependencies.resolveOpenRouterApiKey ?? resolveOpenRouterApiKey;
  const openRouterApiKey = await resolveKey(env.OPENROUTER_API_KEY);
  const vectorIndex = env.CAPABILITY_VECTOR_INDEX
    ? (dependencies.vectorIndexFactory?.(env.CAPABILITY_VECTOR_INDEX) ??
      new VectorizeEmbeddingIndex(env.CAPABILITY_VECTOR_INDEX))
    : undefined;
  const embedQuery = async (text: string): Promise<number[]> => {
    const offline = dependencies.isEmbeddingOffline ?? isEmbeddingOffline;
    if (!vectorIndex && offline(env)) {
      return [];
    }
    const embed = dependencies.embedTexts ?? embedTexts;
    const [vector] = await embed(env, [text]);
    return vector ?? [];
  };
  const runSearch =
    dependencies.searchFunctionsWithContext ?? searchFunctionsWithContext;
  return runSearch(
    {
      embedQuery: vectorIndex ? embedQuery : undefined,
      hot,
      vectorIndex,
    },
    input,
    {
      ...options,
      rerankScorer:
        options?.rerankScorer ?? createJevSearchRerankScorer(openRouterApiKey),
    }
  );
};
