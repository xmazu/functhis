export const VECTOR_SIMILARITY_CUTOFF = 0.45;

export interface SearchCandidateRow {
  contract: unknown;
  distance?: number | null;
  exactMatch: boolean;
  functionSlug: string;
  handle: string;
  packageSlug: string;
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
    row.handle.toLowerCase() === normalized
  );
};

export const rankSearchCandidates = (
  candidates: SearchCandidateRow[],
  limit: number
): RankedSearchHit[] => {
  const sorted = [...candidates].toSorted((left, right) => {
    if (left.exactMatch !== right.exactMatch) {
      return left.exactMatch ? -1 : 1;
    }
    const leftDistance = left.distance ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distance ?? Number.POSITIVE_INFINITY;
    return leftDistance - rightDistance;
  });

  return sorted.slice(0, limit).map((row) => ({
    contract: row.contract,
    functionSlug: row.functionSlug,
    handle: row.handle,
    packageSlug: row.packageSlug,
  }));
};
