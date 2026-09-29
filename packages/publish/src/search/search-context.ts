import type { HotFunctionDoc } from '../catalog/hot-catalog';
import type { HotKvBinding } from '../http/http-context';
import type { SearchRerankScorer } from './search-rerank';
import type {
  SearchExplanationRow,
  SearchHit,
  SearchTiming,
} from './search-result';
import type { EmbeddingIndex } from './vectorize-index';

export interface SearchFunctionsContext {
  embedQueries?: (texts: readonly string[]) => Promise<number[][]>;
  hot: HotKvBinding;
  nowMs?: number;
  vectorIndex?: EmbeddingIndex;
}

export interface SearchFunctionsOptions {
  remainingBudgetMs?: number;
  rerankScorer?: SearchRerankScorer;
}

export interface CatalogSearchInput {
  callerUserId: string;
  docs: HotFunctionDoc[];
  docsById: Map<string, HotFunctionDoc>;
  phrasings: string[];
  primaryQuery: string;
  started: number;
  timing: SearchTiming;
}

export interface CatalogSearchOutcome {
  ambiguous: boolean;
  explanation: SearchExplanationRow[];
  reason: 'browse' | 'no_match' | 'ok';
  results: SearchHit[];
}
