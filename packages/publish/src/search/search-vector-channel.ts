import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { withTimeout } from './search-budget';
import type { SearchFunctionsContext } from './search-context';
import { mergeBestRankMaps } from './search-fusion';
import {
  SEARCH_VECTOR_BUDGET_MS,
  SEARCH_VECTOR_MAX_NAMESPACES,
  SEARCH_VECTOR_MIN_SCORE,
  SEARCH_VECTOR_TOP_K,
} from './search-result';
import type { SearchTiming } from './search-result';

export const vectorNamespacesForSearchDocs = (
  docs: readonly HotFunctionDoc[]
): string[] => {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    if (!doc.organizationId) {
      continue;
    }
    counts.set(doc.organizationId, (counts.get(doc.organizationId) ?? 0) + 1);
  }
  const ordered = [...counts.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .map(([organizationId]) => organizationId);
  return ordered.slice(0, SEARCH_VECTOR_MAX_NAMESPACES);
};

const ranksFromVectorMatches = (
  matches: { id: string; score: number }[],
  docsById: Map<string, HotFunctionDoc>
): Map<string, number> => {
  const seen = new Set<string>();
  const ranks = new Map<string, number>();
  let rank = 1;
  for (const match of matches.toSorted(
    (left, right) => right.score - left.score
  )) {
    if (
      !docsById.has(match.id) ||
      seen.has(match.id) ||
      match.score < SEARCH_VECTOR_MIN_SCORE
    ) {
      continue;
    }
    seen.add(match.id);
    ranks.set(match.id, rank);
    rank += 1;
  }
  return ranks;
};

export const buildVectorRankMap = async (
  context: SearchFunctionsContext,
  input: {
    docs: HotFunctionDoc[];
    docsById: Map<string, HotFunctionDoc>;
    phrasings: string[];
    timing: SearchTiming;
  }
): Promise<Map<string, number>> => {
  const vectorRank = new Map<string, number>();
  const { embedQueries, vectorIndex } = context;
  if (!(vectorIndex && embedQueries) || input.phrasings.length === 0) {
    return vectorRank;
  }
  const vectorStarted = Date.now();
  try {
    const queryVectors = await withTimeout(
      embedQueries(input.phrasings),
      SEARCH_VECTOR_BUDGET_MS,
      input.phrasings.map(() => [] as number[])
    );
    const namespaces = vectorNamespacesForSearchDocs(input.docs);
    const rankMaps = await Promise.all(
      queryVectors
        .filter((queryVector) => queryVector.length > 0)
        .map(async (queryVector) => {
          const namespaceMatches = await Promise.all(
            namespaces.map((namespace) =>
              withTimeout(
                vectorIndex.query({
                  limit: SEARCH_VECTOR_TOP_K,
                  namespace,
                  vector: queryVector,
                }),
                SEARCH_VECTOR_BUDGET_MS,
                []
              )
            )
          );
          const matches = namespaceMatches.flat();
          return ranksFromVectorMatches(matches, input.docsById);
        })
    );
    for (const [id, rank] of mergeBestRankMaps(rankMaps)) {
      vectorRank.set(id, rank);
    }
  } catch {
    vectorRank.clear();
  }
  input.timing.vectorMs = Date.now() - vectorStarted;
  return vectorRank;
};
