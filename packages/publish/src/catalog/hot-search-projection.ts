import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { enqueueCapabilityVector } from '../search/vectorize-upsert';
import { bumpCatalogGeneration } from './catalog-generation';
import type { HotFunctionDoc } from './hot-catalog';

/** After a HOT doc write, enqueue Vectorize embedding debt for the capability. */
export const projectCapabilityAfterHotWrite = async (input: {
  doc: HotFunctionDoc;
  hot: HotKvBinding;
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

export const bumpCatalogGenerationsForDocs = async (
  hot: HotKvBinding,
  docs: readonly HotFunctionDoc[]
): Promise<void> => {
  const organizationIds = [
    ...new Set(
      docs
        .map((doc) => doc.organizationId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  await Promise.all(
    organizationIds.map((organizationId) =>
      bumpCatalogGeneration(hot, organizationId)
    )
  );
};

/** After HOT docs are written: enqueue vector debt and bump org catalog generations. */
export const projectHotDocsForSearch = async (
  hot: HotKvBinding,
  docs: readonly HotFunctionDoc[]
): Promise<void> => {
  await Promise.all(
    docs.map((doc) => projectCapabilityAfterHotWrite({ doc, hot }))
  );
  await bumpCatalogGenerationsForDocs(hot, docs);
};
