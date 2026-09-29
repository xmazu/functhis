export const RERANK_POOL_MAX = 20;
export const CLEAR_WINNER_FUSED_RATIO = 0.5;

export interface RerankGateCandidate {
  exactMatch: boolean;
  fusedScore: number;
}

export interface SearchCandidateRow extends RerankGateCandidate {
  contract: unknown;
  functionSlug: string;
  handle: string;
  id: string;
  packageSlug: string;
  rerankSummary: string;
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

export const shouldRerankSearch = (
  candidates: readonly RerankGateCandidate[]
): ShouldRerankSearchResult => {
  if (candidates.length < 2) {
    return { reason: 'skipped-small-pool', rerank: false };
  }

  const [top, second] = candidates;
  if (top?.exactMatch) {
    return { reason: 'skipped-exact-match', rerank: false };
  }

  if (
    top &&
    second &&
    top.fusedScore > 0 &&
    second.fusedScore / top.fusedScore < CLEAR_WINNER_FUSED_RATIO
  ) {
    return { reason: 'skipped-clear-winner', rerank: false };
  }

  return { reason: 'rerank', rerank: true };
};
