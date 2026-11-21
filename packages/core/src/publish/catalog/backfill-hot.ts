import type { HotKvBinding } from '../http/http-context';
import type { HotCatalogSourcePort } from '../ports';
import { syncPackageToHot } from './hot-catalog';

export interface BackfillHotCatalogDeps {
  syncPackage?: typeof syncPackageToHot;
}

/** Rebuild HOT entries for every package with a current version (operator/backfill). */
export const backfillHotCatalog = async (
  hot: HotKvBinding,
  hotSource: HotCatalogSourcePort,
  deps: BackfillHotCatalogDeps = {}
): Promise<{ packagesSynced: number }> => {
  const syncPackage = deps.syncPackage ?? syncPackageToHot;
  const ids = await hotSource.listPackageIdsWithCurrentVersion();
  await Promise.all(ids.map((id) => syncPackage(hot, hotSource, id)));
  return { packagesSynced: ids.length };
};
