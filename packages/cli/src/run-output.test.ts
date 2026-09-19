import { describe, expect, test } from 'bun:test';

import { formatRunResponseBody } from './run-output';

describe('formatRunResponseBody', () => {
  test('pretty-prints JSON responses', () => {
    const response = new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    });
    expect(formatRunResponseBody(response, '{"ok":true}')).toBe(
      '{\n  "ok": true\n}\n'
    );
  });

  test('returns malformed JSON body unchanged', () => {
    const response = new Response('{not json', {
      headers: { 'content-type': 'application/json' },
    });
    expect(formatRunResponseBody(response, '{not json')).toBe('{not json');
  });

  test('returns plain text unchanged', () => {
    const response = new Response('hello', {
      headers: { 'content-type': 'text/plain' },
    });
    expect(formatRunResponseBody(response, 'hello')).toBe('hello');
  });
});
