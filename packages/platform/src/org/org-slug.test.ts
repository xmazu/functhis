import { describe, expect, test } from 'bun:test';

import { normalizeOrganizationSlug } from './org-slug';

describe('normalizeOrganizationSlug', () => {
  test('lowercases, hyphenates, and trims punctuation', () => {
    expect(normalizeOrganizationSlug(' Acme Corp ')).toBe('acme-corp');
    expect(normalizeOrganizationSlug('---')).toBe('org');
  });
});
