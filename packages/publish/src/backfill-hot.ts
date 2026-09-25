import type { Database } from '@functhis/db';
import { pkg } from '@functhis/db/schema/catalog';
import { isNotNull } from 'drizzle-orm';

import { syncPackageToHot } from './hot-catalog';
import type { HotKvBinding } from './http-context';

export interface BackfillHotCatalogDeps {
  syncPackage?: typeof syncPackageToHot;
}

/** Rebuild HOT entries for every package with a current version (operator/backfill). */
export const backfillHotCatalog = async (
  hot: HotKvBinding,
  database: Database,
  deps: BackfillHotCatalogDeps = {}
): Promise<{ packagesSynced: number }> => {
  const syncPackage = deps.syncPackage ?? syncPackageToHot;
  const packages = await database
    .select({ id: pkg.id })
    .from(pkg)
    .where(isNotNull(pkg.currentVersionId));

  const ids = packages
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));
  await Promise.all(ids.map((id) => syncPackage(hot, database, id)));
  return { packagesSynced: ids.length };
};
