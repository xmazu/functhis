import { describe, expect, test } from 'bun:test';

import { summarizeMcpSearchQuery } from './mcp-log';

describe('summarizeMcpSearchQuery', () => {
  test('truncates long queries', () => {
    const query = 'a'.repeat(200);
    expect(summarizeMcpSearchQuery(query).endsWith('…')).toBe(true);
    expect(summarizeMcpSearchQuery(query).length).toBeLessThan(query.length);
  });
});
