import {
  asHotKvBinding,
  formatFunctionId,
  mineIndexHotKey,
  writeHotFunctionDoc,
  writeMembershipHot,
} from '@functhis/publish';
import type { HotFunctionDoc } from '@functhis/publish';
import { projectHotDocsForSearch } from '@functhis/publish/hot-search-projection';

import type { MemoryHotKv } from './memory-hot-kv';

export interface SeedHotSearchCatalogInput {
  functions: {
    contract?: Record<string, unknown>;
    functionSlug: string;
    packageSlug?: string;
    searchText: string;
  }[];
  handle: string;
  organizationId?: string | null;
  ownerUserId: string;
  packageSlug: string;
}

const writeDocsToHot = (
  hot: ReturnType<typeof asHotKvBinding>,
  input: SeedHotSearchCatalogInput
): Promise<{ doc: HotFunctionDoc; id: string }[]> => {
  const organizationId = input.organizationId ?? null;
  return Promise.all(
    input.functions.map(async (fn) => {
      const packageSlug = fn.packageSlug ?? input.packageSlug;
      const id = formatFunctionId({
        functionSlug: fn.functionSlug,
        handle: input.handle,
        packageSlug,
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
        packageSlug,
        searchText: fn.searchText,
        versionId: crypto.randomUUID(),
        visibility: 'private',
      };

      await writeHotFunctionDoc(hot, doc);
      return { doc, id };
    })
  );
};

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

  const docs = await writeDocsToHot(hot, input);
  const ids = docs.map(({ id }) => id);
  await memoryHot.put(mineIndexHotKey(input.ownerUserId), JSON.stringify(ids));
  await projectHotDocsForSearch(
    hot,
    docs.map(({ doc }) => doc)
  );
  return ids;
};

export interface EvalCatalogEntry {
  contract?: Record<string, unknown>;
  functionSlug: string;
  handle: string;
  packageSlug: string;
  searchText: string;
}

export const seedEvalSearchCorpus = (
  memoryHot: MemoryHotKv,
  input: {
    catalog: readonly EvalCatalogEntry[];
    handle: string;
    organizationId: string;
    ownerUserId: string;
  }
): Promise<string[]> =>
  seedHotSearchCatalog(memoryHot, {
    functions: input.catalog.map((entry) => ({
      contract: entry.contract,
      functionSlug: entry.functionSlug,
      packageSlug: entry.packageSlug,
      searchText: entry.searchText,
    })),
    handle: input.handle,
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    packageSlug: 'unused',
  });
