/* eslint-disable react/set-state-in-effect */
'use client';

import { IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

import { buttonVariants } from '#/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command';
import { Separator } from '#/components/ui/separator';
import { Spinner } from '#/components/ui/spinner';
import { cn } from '#/lib/utils';
import {
  LOGS_FILTER_FIELDS,
  getFieldOptions,
  getFilterValue,
  getWordByCaretPosition,
  logsFiltersEqual,
  parseLogsFilterInput,
  replaceInputByFieldType,
  serializeLogsFilters,
} from '#/routes/d/-lib/logs-filter-parser';
import type {
  LogsFilterField,
  LogsFilterValues,
} from '#/routes/d/-lib/logs-filter-parser';

const HISTORY_KEY = 'functhis:logs-filter-command';

interface SearchHistoryItem {
  search: string;
  timestamp: number;
}

const boxClassName = cn(
  buttonVariants({ size: 'sm', variant: 'outline' }),
  'h-8 w-full justify-start gap-2 px-2.5 font-normal shadow-none'
);

const Kbd = ({ children }: { children: ReactNode }): ReactElement => (
  <kbd className="bg-muted rounded border px-1 font-sans text-[10px]">
    {children}
  </kbd>
);

const readHistory = (): SearchHistoryItem[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is SearchHistoryItem => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return (
        typeof record.search === 'string' &&
        typeof record.timestamp === 'number'
      );
    });
  } catch {
    return [];
  }
};

const writeHistory = (items: SearchHistoryItem[]): void => {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
};

const CommandItemSuggestions = ({
  field,
}: {
  field: LogsFilterField;
}): ReactElement | null => {
  if (field.type === 'checkbox') {
    return (
      <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
        {getFieldOptions(field)
          .map((value) => `[${value}]`)
          .join(' ')}
      </span>
    );
  }
  if (field.type === 'input') {
    return (
      <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
        [{field.value} input]
      </span>
    );
  }
  return null;
};

interface LogsFilterCommandProps {
  filters: LogsFilterValues;
  isLoading?: boolean;
  onFiltersChange: (filters: LogsFilterValues) => void;
}

export const LogsFilterCommand = ({
  filters,
  isLoading = false,
  onFiltersChange,
}: LogsFilterCommandProps): ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isSerializingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [inputValue, setInputValue] = useState(() =>
    serializeLogsFilters(filters)
  );
  const [lastSearches, setLastSearches] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    if (isSerializingRef.current) {
      isSerializingRef.current = false;
      return;
    }
    if (currentWord !== '' && open) {
      return;
    }
    if (currentWord !== '' && !open) {
      setCurrentWord('');
    }
    if (inputValue.trim() === '' && !open) {
      return;
    }

    const next = parseLogsFilterInput(inputValue);
    if (!logsFiltersEqual(next, filters)) {
      onFiltersChange(next);
    }
  }, [currentWord, filters, inputValue, onFiltersChange, open]);

  useEffect(() => {
    if (!open) {
      isSerializingRef.current = true;
      setInputValue(serializeLogsFilters(filters));
    }
  }, [filters, open]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'k'
      ) {
        return;
      }
      event.preventDefault();
      setOpen((isOpen) => !isOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setLastSearches(readHistory());
      inputRef.current?.focus();
    }
  }, [open]);

  const rememberSearch = (search: string): void => {
    const trimmed = search.trim();
    if (!trimmed) {
      return;
    }
    const timestamp = Date.now();
    const next = [...lastSearches];
    const existingIndex = next.findIndex((item) => item.search === trimmed);
    if (existingIndex === -1) {
      next.push({ search: trimmed, timestamp });
    } else {
      const existing = next[existingIndex];
      if (existing) {
        existing.timestamp = timestamp;
      }
    }
    setLastSearches(next);
    writeHistory(next);
  };

  const openEditor = (): void => {
    setOpen(true);
  };

  return (
    <div>
      <button
        className={cn(
          boxClassName,
          'text-muted-foreground',
          open ? 'hidden' : 'visible'
        )}
        onClick={openEditor}
        type="button"
      >
        {isLoading ? (
          <Spinner className="size-3.5 shrink-0 opacity-50" />
        ) : (
          <IconSearch className="size-3.5 shrink-0 opacity-50" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {inputValue.trim() ? (
            <span className="text-foreground">{inputValue}</span>
          ) : (
            <span>Search logs…</span>
          )}
        </span>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <Command
        className={cn(
          'overflow-visible border-none bg-transparent p-0 shadow-none',
          open ? 'visible' : 'hidden'
        )}
        filter={(value, search) =>
          getFilterValue({ currentWord, search, value })
        }
      >
        <div
          className={cn(
            boxClassName,
            'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]'
          )}
        >
          <IconSearch className="size-3.5 shrink-0 opacity-50" />
          <CommandInput
            className="text-foreground"
            onBlur={() => {
              setOpen(false);
              rememberSearch(inputValue);
            }}
            onInput={(event) => {
              const caretPosition = event.currentTarget.selectionStart ?? -1;
              const { value } = event.currentTarget;
              setCurrentWord(getWordByCaretPosition({ caretPosition, value }));
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Escape') {
                inputRef.current?.blur();
              }
            }}
            onValueChange={setInputValue}
            placeholder="Search logs…"
            ref={inputRef}
            value={inputValue}
          />
        </div>
        <div className="relative">
          <div className="bg-popover text-popover-foreground absolute top-2 z-10 w-full overflow-hidden rounded-lg border outline-hidden">
            <CommandList>
              <CommandGroup heading="Filter">
                {LOGS_FILTER_FIELDS.map((field) => {
                  if (inputValue.includes(`${field.value}:`)) {
                    return null;
                  }
                  return (
                    <CommandItem
                      className="group"
                      key={field.value}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onSelect={(value) => {
                        setInputValue((prev) => {
                          if (currentWord.trim() === '') {
                            return `${prev}${value}:`;
                          }
                          const isStarting = currentWord === prev;
                          const prefix = isStarting ? '' : ' ';
                          const input = prev.replace(
                            `${prefix}${currentWord}`,
                            `${prefix}${value}`
                          );
                          return `${input}:`;
                        });
                        setCurrentWord(`${value}:`);
                      }}
                      value={field.value}
                    >
                      {field.value}
                      <CommandItemSuggestions field={field} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Query">
                {LOGS_FILTER_FIELDS.flatMap((field) => {
                  if (!currentWord.includes(`${field.value}:`)) {
                    return [];
                  }
                  return getFieldOptions(field).map((optionValue) => (
                    <CommandItem
                      key={`${field.value}:${optionValue}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onSelect={(value) => {
                        setInputValue((prev) =>
                          replaceInputByFieldType({
                            currentWord,
                            field,
                            optionValue,
                            prev,
                            value,
                          })
                        );
                        setCurrentWord('');
                      }}
                      value={`${field.value}:${optionValue}`}
                    >
                      {optionValue}
                    </CommandItem>
                  ));
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Suggestions">
                {lastSearches
                  .toSorted((left, right) => right.timestamp - left.timestamp)
                  .slice(0, 5)
                  .map((item) => (
                    <CommandItem
                      className="group"
                      key={`suggestion:${item.search}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onSelect={(value) => {
                        const search = value.replace('suggestion:', '');
                        setInputValue(`${search} `);
                        setCurrentWord('');
                      }}
                      value={`suggestion:${item.search}`}
                    >
                      {item.search}
                      <button
                        className="hover:bg-background ml-auto hidden p-0.5 group-aria-selected:block"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const next = lastSearches.filter(
                            (entry) => entry.search !== item.search
                          );
                          setLastSearches(next);
                          writeHistory(next);
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        type="button"
                      >
                        <IconX className="size-3.5" />
                      </button>
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandEmpty>No results found.</CommandEmpty>
            </CommandList>
            <div className="bg-muted/30 text-muted-foreground flex flex-wrap justify-between gap-3 border-t px-2 py-1.5 text-[length:var(--app-font-size-ui,12px)]">
              <div className="flex flex-wrap gap-3">
                <span>
                  Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
                </span>
                <span>
                  <Kbd>Enter</Kbd> to query
                </span>
                <span>
                  <Kbd>Esc</Kbd> to close
                </span>
                <Separator
                  className="data-[orientation=vertical]:h-3"
                  orientation="vertical"
                />
                <span>
                  Union: <Kbd>level:error,warn</Kbd>
                </span>
                <span>
                  Spaces: <Kbd>message:&quot;a b&quot;</Kbd>
                </span>
              </div>
              {lastSearches.length > 0 ? (
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setLastSearches([]);
                    writeHistory([]);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  type="button"
                >
                  Clear suggestions
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
};
