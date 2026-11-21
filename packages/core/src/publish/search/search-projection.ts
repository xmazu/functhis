import { SEARCH_INTENT_PHRASINGS_MAX } from './search-result';

const MAX_INTENT_PHRASES = 5;

const ACTION_VERB_VARIANTS: Record<string, readonly string[]> = {
  create: ['create', 'make', 'add'],
  delete: ['delete', 'remove'],
  fetch: ['fetch', 'get', 'find'],
  find: ['find', 'search', 'lookup', 'get'],
  get: ['get', 'find', 'fetch', 'lookup'],
  list: ['list', 'find', 'get'],
  lookup: ['lookup', 'search', 'find'],
  remove: ['remove', 'delete'],
  search: ['search', 'find', 'lookup', 'get'],
  update: ['update', 'modify'],
};

const slugWords = (slug: string): string[] =>
  slug
    .split(/[/_.-]+/u)
    .flatMap((segment) =>
      segment
        .replaceAll(/(?<low>[a-z0-9])(?<up>[A-Z])/gu, '$<low> $<up>')
        .split(/\s+/u)
    )
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 0);

const singularForm = (word: string): string =>
  word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
    ? word.slice(0, -1)
    : word;

export const schemaPropertyNames = (schema: unknown): string[] => {
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

const verbVariants = (action: string): string[] => {
  const variants = ACTION_VERB_VARIANTS[action] ?? [action];
  return [...new Set(variants)];
};

const entityForms = (entities: readonly string[]): string[] => {
  const forms: string[] = [];
  for (const entity of entities) {
    forms.push(entity, singularForm(entity));
  }
  return [...new Set(forms)].slice(0, 2);
};

/**
 * Bounded intent phrases derived only from the contract: the description plus
 * verb/entity splits of the slug ("users/search" -> "search users",
 * "find user") qualified by required parameters ("by email"). Nothing is
 * invented beyond what the contract states.
 */
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
  const words = slugWords(input.slug);
  const action = words.at(-1) ?? input.slug;
  const entities =
    words.length > 1 ? words.slice(0, -1) : [singularForm(action)];
  const paramSuffix = names[0] ? ` by ${names[0]}` : '';
  const phrases: string[] = [];
  if (descriptionText) {
    phrases.push(descriptionText);
  }
  for (const verb of verbVariants(action)) {
    for (const entity of entityForms(entities)) {
      if (phrases.length >= MAX_INTENT_PHRASES) {
        break;
      }
      phrases.push(`${verb} ${entity}${paramSuffix}`);
    }
    if (phrases.length >= MAX_INTENT_PHRASES) {
      break;
    }
  }
  if (phrases.length === 0) {
    const fallback = [input.slug, ...names].join(' ').trim();
    return fallback.length > 0 ? [fallback] : [];
  }
  return phrases;
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

/** Query plus intent phrasings for lexical and vector channels. */
export const searchPhrasings = (
  query: string,
  intents?: readonly string[]
): string[] => {
  const seen = new Set<string>();
  const phrasings: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    phrasings.push(trimmed);
  };
  push(query);
  for (const intent of intents ?? []) {
    if (phrasings.length >= SEARCH_INTENT_PHRASINGS_MAX) {
      break;
    }
    push(intent);
  }
  return phrasings;
};
