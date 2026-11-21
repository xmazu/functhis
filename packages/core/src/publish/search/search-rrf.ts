export const SEARCH_RRF_K = 60;

export const reciprocalRankContribution = (
  rank: number | undefined,
  weight: number,
  k = SEARCH_RRF_K
): number => {
  if (rank === undefined) {
    return 0;
  }
  return weight / (k + rank);
};

export const reciprocalRankFusion = (
  rankedLists: readonly (readonly string[])[],
  k = SEARCH_RRF_K
): Map<string, number> => {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    for (const [index, id] of list.entries()) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    }
  }
  return scores;
};
