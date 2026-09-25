import {
  asHotKvBinding,
  formatFunctionId,
  mineIndexHotKey,
  writeHotFunctionDoc,
  writeMembershipHot,
} from '@functhis/publish';
import type { HotFunctionDoc } from '@functhis/publish';

import type { MemoryHotKv } from './memory-hot-kv';

export interface SeedHotSearchCatalogInput {
  functions: { functionSlug: string; searchText: string }[];
  handle: string;
  ownerUserId: string;
  packageSlug: string;
}

export const seedHotSearchCatalog = async (
  memoryHot: MemoryHotKv,
  input: SeedHotSearchCatalogInput
): Promise<string[]> => {
  const hot = asHotKvBinding(memoryHot);
  await writeMembershipHot(hot, input.ownerUserId, []);

  const docs = input.functions.map((fn) => {
    const id = formatFunctionId({
      functionSlug: fn.functionSlug,
      handle: input.handle,
      packageSlug: input.packageSlug,
    });

    const doc: HotFunctionDoc = {
      bundleHash: `bundle-${fn.functionSlug}`,
      contract: { slug: fn.functionSlug },
      functionId: crypto.randomUUID(),
      functionSlug: fn.functionSlug,
      handle: input.handle,
      organizationId: null,
      ownerUserId: input.ownerUserId,
      packageId: crypto.randomUUID(),
      packageSlug: input.packageSlug,
      searchText: fn.searchText,
      versionId: crypto.randomUUID(),
      visibility: 'private',
    };

    return { doc, id };
  });

  await Promise.all(docs.map(({ doc }) => writeHotFunctionDoc(hot, doc)));

  const ids = docs.map(({ id }) => id);
  await memoryHot.put(mineIndexHotKey(input.ownerUserId), JSON.stringify(ids));
  return ids;
};
