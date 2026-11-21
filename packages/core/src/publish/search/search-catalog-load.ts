import {
  filterDocsByAccess,
  loadHotFunctionDocsFromKv,
  loadSearchFunctionIdsFromHot,
} from '../catalog/hot-catalog';
import type { HotFunctionDoc, SearchDomain } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import type { SearchLoadPolicy } from './search-access';

export const loadSearchDocs = async (
  hot: HotKvBinding,
  domain: SearchDomain,
  callerUserId: string,
  loadPolicy: SearchLoadPolicy
): Promise<{
  accessContext: Awaited<ReturnType<SearchLoadPolicy['accessContext']>>;
  docs: HotFunctionDoc[];
  docsById: Map<string, HotFunctionDoc>;
}> => {
  const [functionIds, accessContext] = await Promise.all([
    loadSearchFunctionIdsFromHot(hot, domain, callerUserId, () =>
      loadPolicy.organizationIds(callerUserId)
    ),
    loadPolicy.accessContext(callerUserId),
  ]);
  const docs = filterDocsByAccess(
    await loadHotFunctionDocsFromKv(hot, functionIds),
    accessContext,
    loadPolicy.canAccessPackage
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
