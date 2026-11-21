import type { PackageRecord } from '@functhis/core/publish/ports';

import type { pkg } from '../schema/catalog';

export const toPackageRecord = (
  row: typeof pkg.$inferSelect
): PackageRecord => ({
  currentVersionId: row.currentVersionId,
  id: row.id,
  organizationId: row.organizationId,
  ownerUserId: row.ownerUserId,
  slug: row.slug,
  sourceKind: row.sourceKind,
  visibility: row.visibility,
});
