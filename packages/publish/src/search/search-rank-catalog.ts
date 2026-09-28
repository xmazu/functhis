import { cosineSimilarity, deterministicEmbedding } from './embedding';
import { isExactSearchMatch } from './search-exact';
import { fuseSearchCandidates, selectFusedHits } from './search-fusion';
import { scoreFunctionDocument } from './search-lexical';
import { SEARCH_HARD_LIMIT, SEARCH_VECTOR_MIN_SCORE } from './search-result';

export interface RankableDoc {
  functionSlug: string;
  handle: string;
  id: string;
  packageSlug: string;
  searchText: string;
}

export const rankCatalogLexical = (
  query: string,
  docs: readonly RankableDoc[]
): string[] => {
  const trimmed = query.trim();
  const scored = docs.map((doc) => ({
    doc,
    exactMatch: isExactSearchMatch(trimmed, doc),
    lexicalScore: scoreFunctionDocument(trimmed, {
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      id: doc.id,
      packageSlug: doc.packageSlug,
      searchText: doc.searchText,
    }),
  }));
  const kept = scored.filter((row) => row.exactMatch || row.lexicalScore > 0);
  return kept
    .toSorted((left, right) => {
      if (left.exactMatch !== right.exactMatch) {
        return left.exactMatch ? -1 : 1;
      }
      if (right.lexicalScore !== left.lexicalScore) {
        return right.lexicalScore - left.lexicalScore;
      }
      return left.doc.functionSlug.localeCompare(right.doc.functionSlug);
    })
    .slice(0, SEARCH_HARD_LIMIT)
    .map((row) => row.doc.id);
};

export const rankCatalogHybrid = (
  query: string,
  docs: readonly RankableDoc[],
  embed: (text: string) => number[] = deterministicEmbedding
): string[] => {
  const trimmed = query.trim();
  if (trimmed.startsWith('@')) {
    const exactId = docs.find(
      (doc) =>
        isExactSearchMatch(trimmed, doc) &&
        doc.id.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactId) {
      return [exactId.id];
    }
  }
  const queryVector = embed(trimmed);
  const lexicalOrder = docs
    .map((doc) => ({
      doc,
      score: scoreFunctionDocument(trimmed, {
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        id: doc.id,
        packageSlug: doc.packageSlug,
        searchText: doc.searchText,
      }),
    }))
    .toSorted((left, right) => right.score - left.score);
  const vectorOrder = docs
    .map((doc) => ({
      doc,
      score: cosineSimilarity(
        queryVector,
        embed(`${doc.id}\n${doc.searchText}`)
      ),
    }))
    .filter((row) => row.score >= SEARCH_VECTOR_MIN_SCORE)
    .toSorted((left, right) => right.score - left.score);

  const fusionInput = docs.map((doc) => {
    const exactRank = isExactSearchMatch(trimmed, doc) ? 1 : undefined;
    const lexicalIndex = lexicalOrder.findIndex((row) => row.doc.id === doc.id);
    const lexicalRank =
      lexicalIndex !== -1 && (lexicalOrder[lexicalIndex]?.score ?? 0) > 0
        ? lexicalIndex + 1
        : undefined;
    const vectorIndex = vectorOrder.findIndex((row) => row.doc.id === doc.id);
    const vectorRank = vectorIndex === -1 ? undefined : vectorIndex + 1;
    return {
      exactRank,
      id: doc.id,
      lexicalRank,
      vectorRank,
    };
  });
  const fused = fuseSearchCandidates(fusionInput);
  return selectFusedHits(fused, SEARCH_HARD_LIMIT).selected.map(
    (row) => row.id
  );
};
