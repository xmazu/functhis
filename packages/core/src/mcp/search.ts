import { asHotKvBinding } from '../publish/catalog/hot-kv-binding';
import { embedTexts, isEmbeddingOffline } from '../publish/search/embedding';
import { createJevSearchRerankScorer } from '../publish/search/search-jev-rerank';
import { searchFunctionsWithContext } from '../publish/search/search-run';
import type {
  SearchDomain,
  SearchFunctionsOptions,
  SearchResult,
} from '../publish/search/search-run';
import { VectorizeEmbeddingIndex } from '../publish/search/vectorize-index';
import type { McpBindings } from './bindings';
import { resolveOpenRouterApiKey } from './openrouter-api-key';

export interface SearchFunctionsDependencies {
  embedTexts?: typeof embedTexts;
  isEmbeddingOffline?: typeof isEmbeddingOffline;
  resolveOpenRouterApiKey?: typeof resolveOpenRouterApiKey;
  searchFunctionsWithContext?: typeof searchFunctionsWithContext;
  vectorIndexFactory?: (
    binding: NonNullable<McpBindings['CAPABILITY_VECTOR_INDEX']>
  ) => VectorizeEmbeddingIndex;
}

export type { SearchDomain } from '../publish/search/search-run';
export type { SearchHit, SearchResult } from '../publish/search/search-run';
export {
  normalizeSearchDomain,
  searchFunctionsWithContext,
} from '../publish/search/search-run';

export const searchFunctions = async (
  bindings: McpBindings,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    intents?: readonly string[];
    query?: string;
  },
  options?: SearchFunctionsOptions,
  dependencies: SearchFunctionsDependencies = {}
): Promise<SearchResult> => {
  const hot = asHotKvBinding(bindings.HOT);
  const resolveKey =
    dependencies.resolveOpenRouterApiKey ?? resolveOpenRouterApiKey;
  const openRouterApiKey = await resolveKey(bindings.OPENROUTER_API_KEY);
  const vectorIndex = bindings.CAPABILITY_VECTOR_INDEX
    ? (dependencies.vectorIndexFactory?.(bindings.CAPABILITY_VECTOR_INDEX) ??
      new VectorizeEmbeddingIndex(bindings.CAPABILITY_VECTOR_INDEX))
    : undefined;
  const embedQueries = (texts: readonly string[]): Promise<number[][]> => {
    const offline = dependencies.isEmbeddingOffline ?? isEmbeddingOffline;
    if (!vectorIndex && offline(bindings)) {
      return Promise.resolve(texts.map(() => []));
    }
    const embed = dependencies.embedTexts ?? embedTexts;
    return embed(bindings, texts);
  };
  const runSearch =
    dependencies.searchFunctionsWithContext ?? searchFunctionsWithContext;
  return runSearch(
    {
      embedQueries: vectorIndex ? embedQueries : undefined,
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
