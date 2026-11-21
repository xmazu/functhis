/* eslint-disable no-bitwise, no-await-in-loop, unicorn/prefer-code-point -- FNV-1a hash and batched Workers AI calls */

export const CAPABILITY_EMBEDDING_DIMENSIONS = 384;
export const CAPABILITY_EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5';
export const CAPABILITY_EMBEDDING_BATCH_SIZE = 8;
export const CAPABILITY_VECTOR_KIND = 'hosted_function';

const fnv1a32 = (value: string): number => {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
};

export const deterministicEmbedding = (
  text: string,
  dimensions = CAPABILITY_EMBEDDING_DIMENSIONS
): number[] => {
  const normalized = text.toLowerCase().trim();
  const vec = new Float64Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    vec[index] = fnv1a32(`${normalized}:${index}`) / 2 ** 32 - 0.5;
  }
  let norm = 0;
  for (let index = 0; index < dimensions; index += 1) {
    const value = vec[index] ?? 0;
    norm += value * value;
  }
  const scale = Math.sqrt(norm) || 1;
  const result: number[] = [];
  for (let index = 0; index < dimensions; index += 1) {
    result.push((vec[index] ?? 0) / scale);
  }
  return result;
};

export const cosineSimilarity = (
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

export const isEmbeddingOffline = (env: {
  AI?: unknown;
  CAPABILITY_VECTOR_INDEX?: unknown;
  SENTRY_ENVIRONMENT?: string;
  WRANGLER_IS_LOCAL_DEV?: string;
}): boolean => {
  if (env.SENTRY_ENVIRONMENT === 'test') {
    return true;
  }
  if (env.WRANGLER_IS_LOCAL_DEV === 'true') {
    return true;
  }
  if (!env.CAPABILITY_VECTOR_INDEX && env.SENTRY_ENVIRONMENT !== 'production') {
    return true;
  }
  return false;
};

interface WorkersAi {
  run: (
    model: typeof CAPABILITY_EMBEDDING_MODEL,
    input: { text: string[] }
  ) => Promise<{ data?: number[][] }>;
}

export const embedTexts = async (
  env: { AI?: WorkersAi; SENTRY_ENVIRONMENT?: string },
  texts: readonly string[]
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }
  if (!env.AI) {
    if (env.SENTRY_ENVIRONMENT !== 'production') {
      return texts.map((text) => deterministicEmbedding(text));
    }
    throw new Error(
      'AI binding is required for capability embeddings in production.'
    );
  }
  const rows: number[][] = [];
  for (
    let start = 0;
    start < texts.length;
    start += CAPABILITY_EMBEDDING_BATCH_SIZE
  ) {
    const batch = texts.slice(start, start + CAPABILITY_EMBEDDING_BATCH_SIZE);
    const response = await env.AI.run(CAPABILITY_EMBEDDING_MODEL, {
      text: [...batch],
    });
    const data = response.data ?? [];
    for (const [index, _text] of batch.entries()) {
      const vector = data[index];
      if (!vector || vector.length !== CAPABILITY_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Workers AI returned invalid embedding for batch index ${String(index)}`
        );
      }
      rows.push(vector);
    }
  }
  return rows;
};
