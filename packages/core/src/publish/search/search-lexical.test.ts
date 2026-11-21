import { describe, expect, test } from 'bun:test';

import { lexicalScore, scoreFunctionDocument } from './search-lexical';

describe('search-lexical', () => {
  test('scores token overlap between query and document', () => {
    expect(lexicalScore('generate slides', 'generate slides from topic')).toBe(
      1
    );
    expect(lexicalScore('pdf export', 'generate slides')).toBe(0);
  });

  test('scores function documents with slug and search text', () => {
    const score = scoreFunctionDocument('export pdf', {
      functionSlug: 'export-pdf',
      handle: 'alice',
      id: '@alice/tools/export-pdf',
      packageSlug: 'tools',
      searchText: 'Export a PDF document',
    });
    expect(score).toBeGreaterThan(0);
  });
});
