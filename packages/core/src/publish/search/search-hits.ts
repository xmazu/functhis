import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { JsonValue, SearchHit } from './search-result';

export const asSearchContract = (contract: unknown): JsonValue | null => {
  if (contract === null || contract === undefined) {
    return null;
  }
  if (typeof contract !== 'object') {
    return null;
  }
  return contract as JsonValue;
};

export const toHit = (doc: HotFunctionDoc): SearchHit => ({
  availability: doc.availability ?? 'ready',
  contract: asSearchContract(doc.contract),
  id: formatFunctionId({
    functionSlug: doc.functionSlug,
    handle: doc.handle,
    packageSlug: doc.packageSlug,
  }),
});
