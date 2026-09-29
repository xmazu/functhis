import { describe, expect, test } from 'bun:test';

import {
  bumpCatalogGeneration,
  readCatalogGeneration,
  writeCatalogGeneration,
} from './catalog-generation';
import { catalogGenerationHotKey } from './hot-keys';

const memoryHot = () => {
  const store = new Map<string, string>();
  return {
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};

describe('catalog generation', () => {
  test('increments per organization', async () => {
    const hot = memoryHot();
    expect(await readCatalogGeneration(hot, 'org-1')).toBe(0);
    expect(await bumpCatalogGeneration(hot, 'org-1')).toBe(1);
    expect(await bumpCatalogGeneration(hot, 'org-1')).toBe(2);
    expect(await readCatalogGeneration(hot, 'org-2')).toBe(0);
  });

  test('writeCatalogGeneration sets an explicit generation', async () => {
    const hot = memoryHot();
    await writeCatalogGeneration(hot, 'org-1', 42);
    expect(await readCatalogGeneration(hot, 'org-1')).toBe(42);
    expect(await bumpCatalogGeneration(hot, 'org-1')).toBe(43);
  });

  test('readCatalogGeneration treats invalid stored values as zero', async () => {
    const hot = memoryHot();
    await hot.put(catalogGenerationHotKey('org-bad'), 'not-a-number');
    expect(await readCatalogGeneration(hot, 'org-bad')).toBe(0);
  });
});
