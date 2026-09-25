export const SEARCH_LIMIT = 25;
export const RERANK_POOL_MAX = 20;
export const RERANK_SKIP_POOL_SIZE = 8;
export const CLEAR_WINNER_LEXICAL_GAP = 0.25;

export interface SearchCandidateRow {
  contract: unknown;
  exactMatch: boolean;
  functionSlug: string;
  handle: string;
  id: string;
  lexicalScore: number;
  packageSlug: string;
  searchText: string;
}

export type ShouldRerankSearchReason =
  | 'rerank'
  | 'skipped-clear-winner'
  | 'skipped-exact-match'
  | 'skipped-small-pool';

export interface ShouldRerankSearchResult {
  reason: ShouldRerankSearchReason;
  rerank: boolean;
}

export interface RankedSearchHit {
  contract: unknown;
  functionSlug: string;
  handle: string;
  packageSlug: string;
}

export const isExactSearchMatch = (
  query: string,
  row: { functionSlug: string; handle: string; packageSlug: string }
): boolean => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return (
    row.functionSlug.toLowerCase() === normalized ||
    row.packageSlug.toLowerCase() === normalized ||
    row.handle.toLowerCase() === normalized ||
    `@${row.handle}/${row.packageSlug}/${row.functionSlug}`.toLowerCase() ===
      normalized
  );
};

const compareSearchCandidates = (
  left: SearchCandidateRow,
  right: SearchCandidateRow
): number => {
  if (left.exactMatch !== right.exactMatch) {
    return left.exactMatch ? -1 : 1;
  }
  if (right.lexicalScore !== left.lexicalScore) {
    return right.lexicalScore - left.lexicalScore;
  }
  return left.functionSlug.localeCompare(right.functionSlug);
};

export const sortSearchCandidates = (
  candidates: SearchCandidateRow[]
): SearchCandidateRow[] => [...candidates].toSorted(compareSearchCandidates);

export const shouldRerankSearch = (
  sortedCandidates: SearchCandidateRow[]
): ShouldRerankSearchResult => {
  if (sortedCandidates.length === 0) {
    return { reason: 'skipped-small-pool', rerank: false };
  }

  const [top, second] = sortedCandidates;
  if (top?.exactMatch) {
    return { reason: 'skipped-exact-match', rerank: false };
  }

  if (sortedCandidates.length <= RERANK_SKIP_POOL_SIZE) {
    return { reason: 'skipped-small-pool', rerank: false };
  }

  if (
    top &&
    second &&
    top.lexicalScore - second.lexicalScore >= CLEAR_WINNER_LEXICAL_GAP
  ) {
    return { reason: 'skipped-clear-winner', rerank: false };
  }

  return { reason: 'rerank', rerank: true };
};

export const toRankedSearchHit = (
  row: SearchCandidateRow
): RankedSearchHit => ({
  contract: row.contract,
  functionSlug: row.functionSlug,
  handle: row.handle,
  packageSlug: row.packageSlug,
});

export const rankSearchCandidates = (
  candidates: SearchCandidateRow[],
  limit: number
): RankedSearchHit[] =>
  sortSearchCandidates(candidates)
    .slice(0, limit)
    .map((row) => toRankedSearchHit(row));
