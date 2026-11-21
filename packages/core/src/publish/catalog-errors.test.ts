import { describe, expect, test } from 'bun:test';

import { CatalogWriteError, PackageSlugTakenError } from './catalog-errors';

describe('catalog-errors', () => {
  test('PackageSlugTakenError sets name and message', () => {
    const error = new PackageSlugTakenError();
    expect(error.name).toBe('PackageSlugTakenError');
    expect(error.message).toBe('Package slug already exists in organization');
  });

  test('CatalogWriteError sets name and message', () => {
    const error = new CatalogWriteError('write failed');
    expect(error.name).toBe('CatalogWriteError');
    expect(error.message).toBe('write failed');
  });
});
