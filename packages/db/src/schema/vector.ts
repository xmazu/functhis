import { customType } from 'drizzle-orm/pg-core';

export const EMBEDDING_DIMENSIONS = 768;

export const isFiniteEmbedding = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === EMBEDDING_DIMENSIONS &&
  value.every((part) => typeof part === 'number' && Number.isFinite(part));

export const embeddingDriverLiteral = (value: number[]): string | null => {
  if (!isFiniteEmbedding(value)) {
    return null;
  }
  return `[${value.join(',')}]`;
};

export const embeddingVector = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  fromDriver(value: string): number[] {
    if (!value || value === '') {
      return [];
    }
    const trimmed = value.replace(/^\[/u, '').replace(/\]$/u, '');
    if (trimmed.length === 0) {
      return [];
    }
    const parts = trimmed.split(',').map((part) => Number(part.trim()));
    return isFiniteEmbedding(parts) ? parts : [];
  },
  toDriver(value: number[]): string {
    const literal = embeddingDriverLiteral(value);
    if (!literal) {
      throw new Error(
        `embedding must be ${EMBEDDING_DIMENSIONS} finite numbers`
      );
    }
    return literal;
  },
});
