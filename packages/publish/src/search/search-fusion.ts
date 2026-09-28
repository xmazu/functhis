import {
  GRAPH_BONUS_CAP,
  SEARCH_AMBIGUOUS_RATIO,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_HARD_LIMIT,
  SEARCH_NO_MATCH_RRF_FLOOR,
  USAGE_BOOST_CAP,
  VECTOR_RRF_WEIGHT,
} from './search-result';
import type { SearchExplanationRow } from './search-result';
import { reciprocalRankContribution } from './search-rrf';

export interface FusionCandidate {
  exactRank?: number;
  graphBonus?: number;
  id: string;
  lexicalRank?: number;
  usageBoost?: number;
  vectorRank?: number;
}

export interface FusionRow extends SearchExplanationRow {
  nominated: boolean;
  rrfScore: number;
}

const firstRank = (rank: number | undefined): boolean => rank === 1;

export const fuseSearchCandidates = (
  candidates: readonly FusionCandidate[]
): FusionRow[] => {
  const rows = candidates.map((candidate) => {
    const rrfScore =
      reciprocalRankContribution(candidate.exactRank, 1) +
      reciprocalRankContribution(candidate.lexicalRank, 1) +
      reciprocalRankContribution(candidate.vectorRank, VECTOR_RRF_WEIGHT);
    const graphBonus = Math.min(GRAPH_BONUS_CAP, candidate.graphBonus ?? 0);
    const usageBoost = Math.min(USAGE_BOOST_CAP, candidate.usageBoost ?? 0);
    const nominated =
      candidate.exactRank !== undefined ||
      candidate.lexicalRank !== undefined ||
      candidate.vectorRank !== undefined ||
      graphBonus > 0;
    return {
      exactRank: candidate.exactRank,
      fusedScore: rrfScore + graphBonus + usageBoost,
      graphBonus,
      id: candidate.id,
      lexicalRank: candidate.lexicalRank,
      nominated,
      rrfScore,
      usageBoost,
      vectorRank: candidate.vectorRank,
    };
  });
  return rows.toSorted((left, right) => {
    if (right.fusedScore !== left.fusedScore) {
      return right.fusedScore - left.fusedScore;
    }
    return left.id.localeCompare(right.id);
  });
};

export const selectFusedHits = (
  rows: readonly FusionRow[],
  limit = SEARCH_DEFAULT_LIMIT
): {
  ambiguous: boolean;
  reason: 'no_match' | 'ok';
  selected: FusionRow[];
} => {
  const nominated = rows.filter((row) => row.nominated);
  const capped = nominated.slice(0, Math.min(limit, SEARCH_HARD_LIMIT));
  const [top, second] = capped;
  if (
    !top ||
    (top.rrfScore < SEARCH_NO_MATCH_RRF_FLOOR && !firstRank(top.exactRank))
  ) {
    return { ambiguous: false, reason: 'no_match', selected: [] };
  }
  const ambiguous =
    Boolean(second) &&
    !firstRank(top.exactRank) &&
    !firstRank(second?.exactRank) &&
    top.fusedScore > 0 &&
    (second?.fusedScore ?? 0) / top.fusedScore >= SEARCH_AMBIGUOUS_RATIO;
  return { ambiguous, reason: 'ok', selected: capped };
};
