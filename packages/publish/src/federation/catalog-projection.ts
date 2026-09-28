import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { enqueueCapabilityVector } from '../search/vectorize-upsert';

/**
 * Per-doc projection after a HOT write. Enqueues the embedding debt for the
 * capability; the federation search index is rebuilt once per batch by
 * `projectFederationDocs` (see `federation-hot.ts`).
 */
export const projectCapabilityAfterHotWrite = async (input: {
  doc: HotFunctionDoc;
  hot: HotKvBinding;
  secretNames?: readonly string[];
}): Promise<void> => {
  if (!input.doc.organizationId) {
    return;
  }
  const capabilityId = formatFunctionId({
    functionSlug: input.doc.functionSlug,
    handle: input.doc.handle,
    packageSlug: input.doc.packageSlug,
  });
  await enqueueCapabilityVector({
    capabilityId,
    hot: input.hot,
    organizationId: input.doc.organizationId,
    projectionText: input.doc.searchText,
  });
};
