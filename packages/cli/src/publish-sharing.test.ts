import { describe, expect, test } from 'bun:test';

import { parsePublishVisibility } from './publish-sharing';

describe('parsePublishVisibility', () => {
  test('accepts valid values', () => {
    expect(parsePublishVisibility('private')).toBe('private');
    expect(parsePublishVisibility('organization')).toBe('organization');
    expect(parsePublishVisibility('library')).toBe('library');
  });

  test('returns undefined when omitted', () => {
    expect(parsePublishVisibility()).toBeUndefined();
  });

  test('rejects invalid values', () => {
    expect(() => parsePublishVisibility('public')).toThrow(
      /Invalid --visibility/u
    );
  });
});
