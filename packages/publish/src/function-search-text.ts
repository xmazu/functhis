import {
  EMBEDDING_DIMENSIONS,
  isFiniteEmbedding,
} from '@functhis/db/schema/vector';

const BGE_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

const BGE_QUERY_PREFIX =
  'Represent this sentence for searching relevant passages: ';

const schemaPropertyLines = (schema: unknown, prefix = ''): string[] => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }
  const record = schema as Record<string, unknown>;
  if (record.type !== 'object' || !record.properties) {
    return [];
  }
  const properties = record.properties as Record<
    string,
    Record<string, unknown>
  >;
  const lines: string[] = [];
  for (const [name, property] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    lines.push(path);
    const { description } = property;
    if (typeof description === 'string' && description.trim().length > 0) {
      lines.push(description.trim());
    }
    lines.push(...schemaPropertyLines(property, path));
  }
  return lines;
};

export const buildFunctionSearchText = (input: {
  contract: Record<string, unknown>;
  slug: string;
}): string => {
  const parts: string[] = [input.slug];
  const { description } = input.contract;
  if (typeof description === 'string' && description.trim().length > 0) {
    parts.push(description.trim());
  }
  const { examples } = input.contract;
  if (Array.isArray(examples)) {
    for (const example of examples) {
      if (typeof example === 'string' && example.trim().length > 0) {
        parts.push(example.trim());
      }
    }
  }
  parts.push(
    ...schemaPropertyLines(input.contract.inputSchema),
    ...schemaPropertyLines(input.contract.outputSchema)
  );
  return parts.join('\n');
};

export interface TextEmbeddingRunner {
  run: (
    model: string,
    input: { text: string[] }
  ) => Promise<{ data?: number[][] | Float32Array }>;
}

const embeddingVectorFromResult = (
  result: { data?: number[][] | Float32Array },
  index: number
): number[] | null => {
  const { data } = result;
  if (!data) {
    return null;
  }
  if (Array.isArray(data)) {
    const row = data[index];
    return row && isFiniteEmbedding(row) ? [...row] : null;
  }
  if (data.length === EMBEDDING_DIMENSIONS) {
    const vector = [...data];
    return index === 0 && isFiniteEmbedding(vector) ? vector : null;
  }
  const sliceStart = index * EMBEDDING_DIMENSIONS;
  const slice = data.subarray(sliceStart, sliceStart + EMBEDDING_DIMENSIONS);
  if (slice.length !== EMBEDDING_DIMENSIONS) {
    return null;
  }
  const vector = [...slice];
  return isFiniteEmbedding(vector) ? vector : null;
};

export const embedTexts = async (
  ai: TextEmbeddingRunner,
  texts: string[],
  options?: { query: boolean }
): Promise<number[][] | null> => {
  if (texts.length === 0) {
    return [];
  }
  const payload = texts.map((text) =>
    options?.query === true ? `${BGE_QUERY_PREFIX}${text}` : text
  );
  try {
    const result = await ai.run(BGE_EMBEDDING_MODEL, { text: payload });
    const vectors: number[][] = [];
    for (let index = 0; index < texts.length; index += 1) {
      const vector = embeddingVectorFromResult(result, index);
      if (!vector) {
        return null;
      }
      vectors.push(vector);
    }
    return vectors;
  } catch {
    return null;
  }
};

export const embedSearchQuery = async (
  ai: TextEmbeddingRunner,
  query: string
): Promise<number[] | null> => {
  const vectors = await embedTexts(ai, [query], { query: true });
  return vectors?.[0] ?? null;
};
