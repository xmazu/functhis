import { describe, expect, test } from 'bun:test';

import { slugFromRelativePath } from './discover';

describe('slugFromRelativePath', () => {
  test('uses file base name in kebab-case', () => {
    expect(slugFromRelativePath('hello.ts')).toBe('hello');
    expect(slugFromRelativePath('functions/generatePresentation.ts')).toBe(
      'generate-presentation'
    );
    expect(slugFromRelativePath('functions/export_to_pdf.tsx')).toBe(
      'export-to-pdf'
    );
  });
});
