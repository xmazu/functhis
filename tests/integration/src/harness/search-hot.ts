import {
  asHotKvBinding,
  formatFunctionId,
  mineIndexHotKey,
  writeHotFunctionDoc,
  writeMembershipHot,
} from '@functhis/publish';
import type { HotFunctionDoc } from '@functhis/publish';
import { projectFederationDocs } from '@functhis/publish/federation-hot';

import type { MemoryHotKv } from './memory-hot-kv';

export interface SeedHotSearchCatalogInput {
  functions: {
    contract?: Record<string, unknown>;
    functionSlug: string;
    searchText: string;
  }[];
  handle: string;
  organizationId?: string | null;
  ownerUserId: string;
  packageSlug: string;
}

export const seedHotSearchCatalog = async (
  memoryHot: MemoryHotKv,
  input: SeedHotSearchCatalogInput
): Promise<string[]> => {
  const hot = asHotKvBinding(memoryHot);
  const organizationId = input.organizationId ?? null;
  await writeMembershipHot(
    hot,
    input.ownerUserId,
    organizationId ? [organizationId] : []
  );

  const docs = input.functions.map((fn) => {
    const id = formatFunctionId({
      functionSlug: fn.functionSlug,
      handle: input.handle,
      packageSlug: input.packageSlug,
    });

    const doc: HotFunctionDoc = {
      bundleHash: `bundle-${fn.functionSlug}`,
      contract: fn.contract ?? { slug: fn.functionSlug },
      functionId: crypto.randomUUID(),
      functionSlug: fn.functionSlug,
      handle: input.handle,
      organizationId,
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
  await projectFederationDocs(
    hot,
    docs.map(({ doc }) => doc)
  );
  return ids;
};
