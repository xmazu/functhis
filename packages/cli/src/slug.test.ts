import { describe, expect, test } from 'bun:test';

import { slugFromRelativePath } from './discover';

describe('slugFromRelativePath', () => {
  test('uses kebab-case path segments relative to the function root', () => {
    expect(slugFromRelativePath('hello.ts')).toBe('hello');
    expect(slugFromRelativePath('generatePresentation.ts')).toBe(
      'generate-presentation'
    );
    expect(slugFromRelativePath('export_to_pdf.tsx')).toBe('export-to-pdf');
    expect(slugFromRelativePath('support/extend-access.ts')).toBe(
      'support/extend-access'
    );
  });

  test('uses the parent folder for index files', () => {
    expect(slugFromRelativePath('support/index.ts')).toBe('support');
    expect(slugFromRelativePath('index.ts')).toBe('');
  });
});
