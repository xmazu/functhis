export const LOGS_FILTER_ARRAY_DELIMITER = ',';

export interface LogsFilterValues {
  level?: string;
  message?: string;
  package?: string;
}

export interface LogsFilterField {
  options?: { value: string }[];
  type: 'checkbox' | 'input';
  value: string;
}

export const LOG_LEVEL_OPTIONS = ['error', 'warn', 'info', 'log'] as const;

export const LOGS_FILTER_FIELDS: LogsFilterField[] = [
  {
    options: LOG_LEVEL_OPTIONS.map((value) => ({ value })),
    type: 'checkbox',
    value: 'level',
  },
  { type: 'input', value: 'package' },
  { type: 'input', value: 'message' },
];

const FIELD_KEYS = new Set(LOGS_FILTER_FIELDS.map((field) => field.value));

const quoteValue = (value: string): string => {
  if (/[\s"]/u.test(value)) {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return value;
};

export const serializeLogsFilters = (filters: LogsFilterValues): string => {
  const parts: string[] = [];
  if (filters.level?.trim()) {
    parts.push(`level:${quoteValue(filters.level.trim())}`);
  }
  if (filters.package?.trim()) {
    parts.push(`package:${quoteValue(filters.package.trim())}`);
  }
  if (filters.message?.trim()) {
    parts.push(`message:${quoteValue(filters.message.trim())}`);
  }
  return parts.join(' ');
};

export const logsFiltersEqual = (
  left: LogsFilterValues,
  right: LogsFilterValues
): boolean =>
  (left.level ?? '') === (right.level ?? '') &&
  (left.package ?? '') === (right.package ?? '') &&
  (left.message ?? '') === (right.message ?? '');

export const tokenizeLogsFilterInput = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuotes) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/u.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
};

export const parseLogsFilterInput = (input: string): LogsFilterValues => {
  const tokens = tokenizeLogsFilterInput(input.trim());
  const values: LogsFilterValues = {};
  const freeText: string[] = [];

  for (const token of tokens) {
    const colonIndex = token.indexOf(':');
    if (colonIndex <= 0) {
      freeText.push(token);
      continue;
    }
    const key = token.slice(0, colonIndex);
    const rawValue = token.slice(colonIndex + 1);
    if (!FIELD_KEYS.has(key)) {
      freeText.push(token);
      continue;
    }
    if (key === 'level') {
      values.level = rawValue;
    } else if (key === 'package') {
      values.package = rawValue;
    } else if (key === 'message') {
      values.message = rawValue;
    }
  }

  if (freeText.length > 0) {
    const joined = freeText.join(' ');
    values.message = values.message ? `${values.message} ${joined}` : joined;
  }

  return values;
};

export const getWordByCaretPosition = ({
  value,
  caretPosition,
}: {
  value: string;
  caretPosition: number;
}): string => {
  let start = caretPosition;
  let end = caretPosition;

  while (start > 0 && value[start - 1] !== ' ') {
    start -= 1;
  }
  while (end < value.length && value[end] !== ' ') {
    end += 1;
  }

  return value.slice(start, end);
};

export const getFieldOptions = (field: LogsFilterField): string[] =>
  field.options?.map((option) => option.value) ?? [];

export const replaceInputByFieldType = ({
  currentWord,
  field,
  optionValue,
  prev,
  value,
}: {
  currentWord: string;
  field: LogsFilterField;
  optionValue?: string;
  prev: string;
  value: string;
}): string => {
  if (
    field.type === 'checkbox' &&
    currentWord.includes(LOGS_FILTER_ARRAY_DELIMITER)
  ) {
    const words = currentWord.split(LOGS_FILTER_ARRAY_DELIMITER);
    words[words.length - 1] = optionValue ?? '';
    const input = prev.replace(
      currentWord,
      words.join(LOGS_FILTER_ARRAY_DELIMITER)
    );
    return `${input.trim()} `;
  }

  const quotedValue = optionValue ? quoteValue(optionValue) : value;
  const input = prev.replace(currentWord, `${field.value}:${quotedValue}`);
  return `${input.trim()} `;
};

export const getFilterValue = ({
  currentWord,
  search,
  value,
}: {
  currentWord: string;
  search: string;
  value: string;
}): number => {
  if (value.startsWith('suggestion:')) {
    const rawValue = value.toLowerCase().replace('suggestion:', '');
    if (rawValue.includes(search.toLowerCase())) {
      return 1;
    }
    return 0;
  }

  if (value.toLowerCase().includes(currentWord.toLowerCase())) {
    return 1;
  }

  const lowerCurrentWord = currentWord.toLowerCase();
  const separatorIndex = lowerCurrentWord.indexOf(':');
  const filter =
    separatorIndex === -1
      ? lowerCurrentWord
      : lowerCurrentWord.slice(0, separatorIndex);
  const query =
    separatorIndex === -1
      ? undefined
      : lowerCurrentWord.slice(separatorIndex + 1);

  if (query && value.startsWith(`${filter}:`)) {
    if (query.includes(LOGS_FILTER_ARRAY_DELIMITER)) {
      const queries = query.split(LOGS_FILTER_ARRAY_DELIMITER);
      const rawValue = value.toLowerCase().replace(`${filter}:`, '');
      if (
        queries.some(
          (item, index) => item === rawValue && index !== queries.length - 1
        )
      ) {
        return 0;
      }
      if (queries.some((item) => rawValue.includes(item))) {
        return 1;
      }
    }
    const rawValue = value.toLowerCase().replace(`${filter}:`, '');
    if (rawValue.includes(query)) {
      return 1;
    }
  }
  return 0;
};
