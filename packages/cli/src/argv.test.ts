import { describe, expect, test } from 'bun:test';

import { parseBooleanFlag, parseFlag, parseJsonInput } from './argv';

describe('parseBooleanFlag', () => {
  test('detects presence', () => {
    expect(parseBooleanFlag(['--major'], '--major')).toBe(true);
    expect(parseBooleanFlag(['--minor'], '--major')).toBe(false);
  });
});

describe('parseFlag', () => {
  test('reads a flag value', () => {
    expect(parseFlag(['--slug', 'hello', '--other'], '--slug')).toBe('hello');
  });

  test('returns undefined when the flag is absent or has no value', () => {
    expect(parseFlag(['--other', 'x'], '--slug')).toBeUndefined();
    expect(parseFlag(['--slug'], '--slug')).toBeUndefined();
  });
});

describe('parseJsonInput', () => {
  test('defaults to empty object', () => {
    expect(parseJsonInput()).toEqual({ ok: true, value: {} });
  });

  test('parses JSON objects', () => {
    expect(parseJsonInput('{"name":"Ada"}')).toEqual({
      ok: true,
      value: { name: 'Ada' },
    });
  });

  test('rejects invalid JSON', () => {
    expect(parseJsonInput('{bad')).toEqual({
      error: 'Invalid JSON for --input',
      ok: false,
    });
  });
});
