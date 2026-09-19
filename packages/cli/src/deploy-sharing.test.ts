import { describe, expect, test } from 'bun:test';

import { parseDeployVisibility } from './deploy-sharing';

describe('parseDeployVisibility', () => {
  test('accepts valid values', () => {
    expect(parseDeployVisibility('private')).toBe('private');
    expect(parseDeployVisibility('organization')).toBe('organization');
    expect(parseDeployVisibility('library')).toBe('library');
  });

  test('returns undefined when omitted', () => {
    expect(parseDeployVisibility()).toBeUndefined();
  });

  test('rejects invalid values', () => {
    expect(() => parseDeployVisibility('public')).toThrow(
      /Invalid --visibility/u
    );
  });
});
