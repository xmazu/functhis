/* eslint-disable max-classes-per-file, require-await, typescript/parameter-properties -- in-memory index is a test double beside the Vectorize adapter */

import { CAPABILITY_VECTOR_KIND } from './embedding';

export interface VectorMatch {
  id: string;
  score: number;
}

export interface EmbeddingIndexQuery {
  filterKind?: string;
  limit: number;
  namespace: string;
  vector: readonly number[];
}

export interface EmbeddingIndexUpsert {
  id: string;
  metadata: Record<string, string>;
  namespace: string;
  values: readonly number[];
}

export interface EmbeddingIndex {
  deleteByIds: (ids: readonly string[]) => Promise<void>;
  query: (input: EmbeddingIndexQuery) => Promise<VectorMatch[]>;
  upsert: (vectors: readonly EmbeddingIndexUpsert[]) => Promise<void>;
}

export const cosineFromUnitVectors = (
  left: readonly number[],
  right: readonly number[]
): number => {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
};

export class MemoryEmbeddingIndex implements EmbeddingIndex {
  private readonly rows = new Map<
    string,
    { metadata: Record<string, string>; namespace: string; values: number[] }
  >();

  async deleteByIds(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.rows.delete(id);
    }
  }

  async query(input: EmbeddingIndexQuery): Promise<VectorMatch[]> {
    const kind = input.filterKind ?? CAPABILITY_VECTOR_KIND;
    const scored: VectorMatch[] = [];
    for (const [id, row] of this.rows) {
      if (row.namespace !== input.namespace) {
        continue;
      }
      if (row.metadata.kind !== kind) {
        continue;
      }
      scored.push({
        id,
        score: cosineFromUnitVectors(input.vector, row.values),
      });
    }
    return scored
      .toSorted((left, right) => right.score - left.score)
      .slice(0, input.limit);
  }

  async upsert(vectors: readonly EmbeddingIndexUpsert[]): Promise<void> {
    for (const vector of vectors) {
      this.rows.set(vector.id, {
        metadata: vector.metadata,
        namespace: vector.namespace,
        values: [...vector.values],
      });
    }
  }
}

interface VectorizeBinding {
  deleteByIds: (ids: string[]) => Promise<unknown>;
  query: (
    vector: number[],
    options: {
      filter?: Record<string, { $eq: string }>;
      namespace: string;
      returnMetadata: 'none';
      topK: number;
    }
  ) => Promise<{ matches: { id?: string; score: number }[] }>;
  upsert: (
    rows: {
      id: string;
      metadata: Record<string, string>;
      namespace: string;
      values: number[];
    }[]
  ) => Promise<unknown>;
}

export class VectorizeEmbeddingIndex implements EmbeddingIndex {
  constructor(private readonly index: VectorizeBinding) {}

  async deleteByIds(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.index.deleteByIds([...ids]);
  }

  async query(input: EmbeddingIndexQuery): Promise<VectorMatch[]> {
    const kind = input.filterKind ?? CAPABILITY_VECTOR_KIND;
    const result = await this.index.query([...input.vector], {
      filter: { kind: { $eq: kind } },
      namespace: input.namespace,
      returnMetadata: 'none',
      topK: Math.min(Math.max(input.limit, 1), 100),
    });
    const matches: VectorMatch[] = [];
    const seen = new Set<string>();
    for (const match of result.matches) {
      if (typeof match.id !== 'string' || seen.has(match.id)) {
        continue;
      }
      seen.add(match.id);
      matches.push({ id: match.id, score: match.score });
    }
    return matches;
  }

  async upsert(vectors: readonly EmbeddingIndexUpsert[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    await this.index.upsert(
      vectors.map((vector) => ({
        id: vector.id,
        metadata: vector.metadata,
        namespace: vector.namespace,
        values: [...vector.values],
      }))
    );
  }
}
