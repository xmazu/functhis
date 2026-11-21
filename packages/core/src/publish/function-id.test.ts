import { describe, expect, test } from 'bun:test';

import {
  formatFunctionId,
  isValidFunctionSlug,
  parseFunctionId,
} from './function-id';

describe('parseFunctionId', () => {
  test('accepts canonical ids', () => {
    expect(parseFunctionId('@xmazu/hello-world/hello')).toEqual({
      functionSlug: 'hello',
      handle: 'xmazu',
      packageSlug: 'hello-world',
    });
  });

  test('accepts nested namespace slugs', () => {
    expect(parseFunctionId('@neroli/tools/support/extend-access')).toEqual({
      functionSlug: 'support/extend-access',
      handle: 'neroli',
      packageSlug: 'tools',
    });
  });

  test('rejects malformed ids', () => {
    expect(parseFunctionId('hello-world/hello')).toBeNull();
    expect(parseFunctionId('@xmazu/hello')).toBeNull();
  });
});

describe('formatFunctionId', () => {
  test('round-trips nested namespace slugs', () => {
    const id = formatFunctionId({
      functionSlug: 'support/extend-access',
      handle: 'neroli',
      packageSlug: 'tools',
    });
    expect(id).toBe('@neroli/tools/support/extend-access');
    expect(parseFunctionId(id)).toEqual({
      functionSlug: 'support/extend-access',
      handle: 'neroli',
      packageSlug: 'tools',
    });
  });
});

describe('isValidFunctionSlug', () => {
  test('rejects empty and overly long slugs', () => {
    expect(isValidFunctionSlug('')).toBe(false);
    expect(isValidFunctionSlug('a'.repeat(257))).toBe(false);
    expect(isValidFunctionSlug('hello')).toBe(true);
  });
});
