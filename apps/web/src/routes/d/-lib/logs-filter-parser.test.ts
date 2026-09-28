import { describe, expect, it } from 'bun:test';

import {
  getFilterValue,
  parseLogsFilterInput,
  replaceInputByFieldType,
  serializeLogsFilters,
  tokenizeLogsFilterInput,
} from '#/routes/d/-lib/logs-filter-parser';

describe('logs-filter-parser', () => {
  it('serializes and parses structured filters', () => {
    const filters = {
      level: 'error,warn',
      message: 'timeout',
      package: 'my-pkg',
    };
    const serialized = serializeLogsFilters(filters);
    expect(serialized).toBe('level:error,warn package:my-pkg message:timeout');
    expect(parseLogsFilterInput(serialized)).toEqual(filters);
  });

  it('quotes values with spaces', () => {
    const serialized = serializeLogsFilters({ message: 'hello world' });
    expect(serialized).toBe('message:"hello world"');
    expect(parseLogsFilterInput(serialized)).toEqual({
      message: 'hello world',
    });
  });

  it('treats bare words as message search', () => {
    expect(parseLogsFilterInput('payment failed')).toEqual({
      message: 'payment failed',
    });
  });

  it('tokenizes quoted segments', () => {
    expect(tokenizeLogsFilterInput('message:"a b" level:error')).toEqual([
      'message:a b',
      'level:error',
    ]);
  });

  it('ranks field names and query options from the current word', () => {
    expect(
      getFilterValue({ currentWord: 'lev', search: 'lev', value: 'level' })
    ).toBe(1);
    expect(
      getFilterValue({
        currentWord: 'level:w',
        search: 'level:w',
        value: 'level:warn',
      })
    ).toBe(1);
    expect(
      getFilterValue({
        currentWord: 'level:w',
        search: 'level:w',
        value: 'level:error',
      })
    ).toBe(0);
  });

  it('appends checkbox unions with a trailing space', () => {
    expect(
      replaceInputByFieldType({
        currentWord: 'level:error,',
        field: {
          options: [{ value: 'warn' }],
          type: 'checkbox',
          value: 'level',
        },
        optionValue: 'warn',
        prev: 'level:error,',
        value: 'level:warn',
      })
    ).toBe('level:error,warn ');
  });
});
