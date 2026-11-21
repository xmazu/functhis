import { schemaPropertyNames } from './search-projection';
import type { SearchCandidateRow } from './search-ranking';
import { RERANK_POOL_MAX } from './search-ranking';

export interface SearchRerankCard {
  functionSlug: string;
  handle: string;
  id: string;
  packageSlug: string;
  /** Contract summary for the judge (description + params), not raw HOT searchText. */
  summary: string;
}

export type SearchRerankScorer = (
  query: string,
  cards: SearchRerankCard[]
) => Promise<Map<string, number> | null>;

const contractRecord = (contract: unknown): Record<string, unknown> =>
  contract && typeof contract === 'object'
    ? (contract as Record<string, unknown>)
    : {};

export const buildRerankSummary = (
  contract: unknown,
  searchText: string,
  maxChars = 400
): string => {
  const record = contractRecord(contract);
  const description =
    typeof record.description === 'string' ? record.description.trim() : '';
  const params = schemaPropertyNames(record.inputSchema);
  const paramLine = params.length > 0 ? `Parameters: ${params.join(', ')}` : '';
  const combined = [description, paramLine, searchText.trim()]
    .filter((part) => part.length > 0)
    .join('\n');
  return combined.slice(0, maxChars);
};

export const applyAiRerankToSorted = async (
  query: string,
  sorted: SearchCandidateRow[],
  scorer: SearchRerankScorer
): Promise<SearchCandidateRow[]> => {
  const head = sorted.slice(0, RERANK_POOL_MAX);
  const tail = sorted.slice(RERANK_POOL_MAX);
  const cards: SearchRerankCard[] = head.map((row) => ({
    functionSlug: row.functionSlug,
    handle: row.handle,
    id: row.id,
    packageSlug: row.packageSlug,
    summary: row.rerankSummary,
  }));
  const scores = await scorer(query, cards);
  if (!scores) {
    return sorted;
  }
  const headOrder = new Map(head.map((row, index) => [row.id, index]));
  const rerankedHead = [...head].toSorted((left, right) => {
    const leftScore = scores.get(left.id) ?? 0;
    const rightScore = scores.get(right.id) ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return (headOrder.get(left.id) ?? 0) - (headOrder.get(right.id) ?? 0);
  });
  return [...rerankedHead, ...tail];
};
