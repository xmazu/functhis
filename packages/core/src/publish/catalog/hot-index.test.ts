import { describe, expect, test } from 'bun:test';

import { stripPackageFunctionIds } from './hot-index';

describe('stripPackageFunctionIds', () => {
  test('removes ids for org slug and owner handle', () => {
    const ids = ['@acme/demo/hello', '@owner/demo/hello', '@acme/other/world'];
    expect(stripPackageFunctionIds(ids, ['acme', 'owner'], 'demo')).toEqual([
      '@acme/other/world',
    ]);
  });
});
