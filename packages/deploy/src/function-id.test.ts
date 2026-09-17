import { describe, expect, test } from 'bun:test';

import { formatFunctionId, parseFunctionId } from './function-id';

describe('parseFunctionId', () => {
  test('accepts canonical ids', () => {
    expect(parseFunctionId('@xmazu/hello-world/hello')).toEqual({
      functionSlug: 'hello',
      handle: 'xmazu',
      packageSlug: 'hello-world',
    });
  });

  test('rejects malformed ids', () => {
    expect(parseFunctionId('hello-world/hello')).toBeNull();
    expect(parseFunctionId('@xmazu/hello')).toBeNull();
  });
});

describe('formatFunctionId', () => {
  test('round-trips with parseFunctionId', () => {
    const id = formatFunctionId({
      functionSlug: 'hello',
      handle: 'xmazu',
      packageSlug: 'hello-world',
    });
    expect(parseFunctionId(id)).toEqual({
      functionSlug: 'hello',
      handle: 'xmazu',
      packageSlug: 'hello-world',
    });
  });
});
