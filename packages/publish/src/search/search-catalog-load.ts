import {
  buildAccessContextFromHotKv,
  filterDocsByAccess,
  loadHotFunctionDocsFromKv,
  loadSearchFunctionIdsFromHot,
} from '../catalog/hot-catalog';
import type { HotFunctionDoc, SearchDomain } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';

export const loadSearchDocs = async (
  hot: HotKvBinding,
  domain: SearchDomain,
  callerUserId: string
): Promise<{
  accessContext: Awaited<ReturnType<typeof buildAccessContextFromHotKv>>;
  docs: HotFunctionDoc[];
  docsById: Map<string, HotFunctionDoc>;
}> => {
  const [functionIds, accessContext] = await Promise.all([
    loadSearchFunctionIdsFromHot(hot, domain, callerUserId),
    buildAccessContextFromHotKv(hot, callerUserId),
  ]);
  const docs = filterDocsByAccess(
    await loadHotFunctionDocsFromKv(hot, functionIds),
    accessContext
  );
  const docsById = new Map(
    docs.map((doc) => [
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      }),
      doc,
    ])
  );
  return { accessContext, docs, docsById };
};
