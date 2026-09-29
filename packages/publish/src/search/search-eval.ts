export interface SearchEvalJudgment {
  kind:
    | 'direct-overlap'
    | 'exact-id'
    | 'no-match'
    | 'paraphrase'
    | 'synonym'
    | 'zero-overlap';
  query: string;
  relevant: readonly string[];
}

export interface SearchEvalQueryResult {
  ids: readonly string[];
  query: string;
}

const dcg = (gains: readonly number[]): number => {
  let sum = 0;
  for (const [index, gain] of gains.entries()) {
    sum += gain / Math.log2(index + 2);
  }
  return sum;
};

export const recallAtK = (
  ranked: readonly string[],
  relevant: readonly string[],
  k: number
): number => {
  if (relevant.length === 0) {
    return 1;
  }
  const head = new Set(ranked.slice(0, k));
  let hits = 0;
  for (const id of relevant) {
    if (head.has(id)) {
      hits += 1;
    }
  }
  return hits / relevant.length;
};

export const meanReciprocalRank = (
  ranked: readonly string[],
  relevant: readonly string[]
): number => {
  if (relevant.length === 0) {
    return ranked.length === 0 ? 1 : 0;
  }
  const wanted = new Set(relevant);
  for (const [index, id] of ranked.entries()) {
    if (wanted.has(id)) {
      return 1 / (index + 1);
    }
  }
  return 0;
};

export const ndcgAtK = (
  ranked: readonly string[],
  relevant: readonly string[],
  k: number
): number => {
  if (relevant.length === 0) {
    return ranked.length === 0 ? 1 : 0;
  }
  const wanted = new Set(relevant);
  const gains = ranked.slice(0, k).map((id) => (wanted.has(id) ? 1 : 0));
  const ideal = Array.from({ length: Math.min(k, relevant.length) }, () => 1);
  const idealDcg = dcg(ideal);
  if (idealDcg === 0) {
    return 0;
  }
  return dcg(gains) / idealDcg;
};

export const noMatchPrecision = (
  results: readonly SearchEvalQueryResult[],
  judgments: readonly SearchEvalJudgment[]
): number => {
  const noMatch = judgments.filter((row) => row.kind === 'no-match');
  if (noMatch.length === 0) {
    return 1;
  }
  let correct = 0;
  for (const judgment of noMatch) {
    const ranked = results.find((row) => row.query === judgment.query);
    if (ranked && ranked.ids.length === 0) {
      correct += 1;
    }
  }
  return correct / noMatch.length;
};

export interface SearchEvalReport {
  mrr: number;
  ndcgAt10: number;
  noMatchPrecision: number;
  p95Ms: number;
  recallAt10: number;
}

export const evaluateSearchRanking = (
  results: readonly SearchEvalQueryResult[],
  judgments: readonly SearchEvalJudgment[],
  latenciesMs: readonly number[]
): SearchEvalReport => {
  const byQuery = new Map(results.map((row) => [row.query, row.ids]));
  let recallSum = 0;
  let mrrSum = 0;
  let ndcgSum = 0;
  for (const judgment of judgments) {
    const ranked = byQuery.get(judgment.query) ?? [];
    recallSum += recallAtK(ranked, judgment.relevant, 10);
    mrrSum += meanReciprocalRank(ranked, judgment.relevant);
    ndcgSum += ndcgAtK(ranked, judgment.relevant, 10);
  }
  const count = judgments.length;
  const sortedLatencies = [...latenciesMs].toSorted(
    (left, right) => left - right
  );
  const p95Index =
    sortedLatencies.length === 0
      ? 0
      : Math.min(
          sortedLatencies.length - 1,
          Math.ceil(sortedLatencies.length * 0.95) - 1
        );
  return {
    mrr: count === 0 ? 0 : mrrSum / count,
    ndcgAt10: count === 0 ? 0 : ndcgSum / count,
    noMatchPrecision: noMatchPrecision(results, judgments),
    p95Ms: sortedLatencies[p95Index] ?? 0,
    recallAt10: count === 0 ? 0 : recallSum / count,
  };
};
