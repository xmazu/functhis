const MAX_INTENT_PHRASES = 5;

const schemaPropertyNames = (schema: unknown): string[] => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }
  const record = schema as Record<string, unknown>;
  if (record.type !== 'object' || !record.properties) {
    return [];
  }
  return Object.keys(record.properties as Record<string, unknown>);
};

const requiredPropertyNames = (schema: unknown): string[] => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }
  const record = schema as Record<string, unknown>;
  if (!Array.isArray(record.required)) {
    return [];
  }
  return record.required.filter(
    (value): value is string => typeof value === 'string'
  );
};

export const buildIntentPhrases = (input: {
  contract: Record<string, unknown>;
  slug: string;
}): string[] => {
  const { description } = input.contract;
  const descriptionText =
    typeof description === 'string' && description.trim().length > 0
      ? description.trim()
      : null;
  const required = requiredPropertyNames(input.contract.inputSchema);
  const names =
    required.length > 0
      ? required
      : schemaPropertyNames(input.contract.inputSchema);
  if (!descriptionText) {
    const fallback = [input.slug, ...names].join(' ').trim();
    return fallback.length > 0 ? [fallback] : [];
  }
  if (names.length === 0) {
    return [descriptionText];
  }
  return names
    .slice(0, MAX_INTENT_PHRASES)
    .map((name) => `${descriptionText} ${name}`);
};

export const truncateEmbeddingInput = (
  text: string,
  maxChars = 2000
): string => {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars);
};

export const buildEmbeddingInput = (input: {
  id: string;
  projectionText: string;
}): string => truncateEmbeddingInput(`${input.id}\n${input.projectionText}`);
