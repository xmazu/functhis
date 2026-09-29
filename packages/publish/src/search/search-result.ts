export const SEARCH_DEFAULT_LIMIT = 15;
export const SEARCH_HARD_LIMIT = 25;
export const SEARCH_BROWSE_MAX = 25;
export const SEARCH_INTENT_PHRASINGS_MAX = 5;
export const SEARCH_PAYLOAD_MAX_BYTES = 24 * 1024;
export const SEARCH_NO_MATCH_RRF_FLOOR = 0.01;
export const SEARCH_AMBIGUOUS_RATIO = 0.85;
export const SEARCH_DEADLINE_MS = 8000;
export const SEARCH_JEV_BUDGET_MS = 4000;
export const SEARCH_VECTOR_BUDGET_MS = 1500;
export const SEARCH_LEXICAL_TOP = 25;
export const SEARCH_VECTOR_TOP_K = 100;
export const SEARCH_VECTOR_MIN_SCORE = 0.35;
/** Max org Vectorize namespaces queried per search (library multi-tenant cap). */
export const SEARCH_VECTOR_MAX_NAMESPACES = 8;
export const VECTOR_RRF_WEIGHT = 1;

export type CapabilityAvailability = 'degraded' | 'ready' | 'unavailable';
export type CapabilitySourceKind =
  | 'hosted_function'
  | 'openapi_operation'
  | 'remote_mcp_tool';

export type JsonValue =
  | JsonValue[]
  | boolean
  | number
  | string
  | { readonly [key: string]: JsonValue }
  | null;

export interface SearchHit {
  availability: CapabilityAvailability;
  contract: JsonValue | null;
  id: string;
}

export interface SearchTiming {
  jevMs: number;
  lexicalMs: number;
  loadMs: number;
  totalMs: number;
  vectorMs: number;
}

export interface SearchExplanationRow {
  exactRank?: number;
  fusedScore: number;
  id: string;
  lexicalRank?: number;
  vectorRank?: number;
}

export interface SearchResult {
  ambiguous: boolean;
  explanation: SearchExplanationRow[];
  reason: 'browse' | 'no_match' | 'ok';
  results: SearchHit[];
  searchId: string;
  timing: SearchTiming;
}

export const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

export const trimSearchResultToBudget = (
  result: SearchResult,
  maxBytes = SEARCH_PAYLOAD_MAX_BYTES
): SearchResult => {
  const clone: SearchResult = {
    ...result,
    explanation: [...result.explanation],
    results: [...result.results],
  };
  while (
    utf8ByteLength(JSON.stringify(clone)) > maxBytes &&
    clone.results.length > 1
  ) {
    clone.results.pop();
    clone.explanation.pop();
  }
  return clone;
};
