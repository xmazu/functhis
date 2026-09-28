const searchTokenPattern = /[a-z0-9]+/gu;
const camelCaseSplitPattern = /(?<low>[a-z0-9])(?<up>[A-Z])/gu;
const combiningMarksPattern = /[\u0300-\u036F]/gu;
const slugSeparatorPattern = /[_./:-]+/gu;

const trivialSearchStopwords = new Set([
  'a',
  'an',
  'and',
  'for',
  'from',
  'i',
  'in',
  'into',
  'is',
  'me',
  'my',
  'of',
  'on',
  'or',
  'please',
  'the',
  'to',
  'with',
]);

export const normalizeSearchText = (text: string): string =>
  text
    .normalize('NFKD')
    .replaceAll(combiningMarksPattern, '')
    .replaceAll(camelCaseSplitPattern, '$<low> $<up>')
    .replaceAll(slugSeparatorPattern, ' ')
    .toLowerCase();

export const extractSearchTokens = (text: string): string[] =>
  normalizeSearchText(text).match(searchTokenPattern) ?? [];

export const extractMeaningfulSearchTokens = (text: string): string[] => {
  const tokens = extractSearchTokens(text);
  const meaningful: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.length < 2) {
      continue;
    }
    if (trivialSearchStopwords.has(token)) {
      continue;
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    meaningful.push(token);
  }
  return meaningful;
};

export const tokenizeSearchText = (value: string): Set<string> => {
  const tokens = new Set(extractSearchTokens(value));
  const splitCamel = value.replaceAll(camelCaseSplitPattern, '$<low> $<up>');
  for (const token of splitCamel.toLowerCase().match(searchTokenPattern) ??
    []) {
    tokens.add(token);
  }
  return tokens;
};

export const lexicalScore = (query: string, doc: string): number => {
  const q = tokenizeSearchText(query);
  const d = tokenizeSearchText(doc);
  if (q.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const t of q) {
    if (d.has(t)) {
      intersection += 1;
    }
  }
  return intersection / q.size;
};

export const buildSearchPhrases = (tokens: readonly string[]): string[] => {
  if (tokens.length < 2) {
    return [];
  }
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (!first || !second) {
      continue;
    }
    phrases.push(`${first} ${second}`);
  }
  return phrases;
};

export const phraseMatchBoost = (
  queryTokens: readonly string[],
  doc: string
): number => {
  const phrases = buildSearchPhrases(queryTokens);
  if (phrases.length === 0) {
    return 0;
  }
  const normalizedDoc = normalizeSearchText(doc);
  let matched = 0;
  for (const phrase of phrases) {
    if (normalizedDoc.includes(phrase)) {
      matched += 1;
    }
  }
  return (matched / phrases.length) * 0.15;
};

export const scoreFunctionDocument = (
  query: string,
  doc: {
    functionSlug: string;
    handle: string;
    id: string;
    packageSlug: string;
    searchText: string;
  }
): number => {
  const docText = [
    doc.id,
    doc.handle,
    doc.packageSlug,
    doc.functionSlug,
    doc.searchText,
  ].join('\n');
  const meaningful = extractMeaningfulSearchTokens(query);
  const queryForLexical =
    meaningful.length > 0 ? meaningful.join(' ') : query.trim();
  const base = lexicalScore(queryForLexical, docText);
  const phraseBoost = phraseMatchBoost(
    meaningful.length > 0 ? meaningful : extractSearchTokens(query),
    docText
  );
  return base + phraseBoost;
};
