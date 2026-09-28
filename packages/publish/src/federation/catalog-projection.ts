import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { enqueueCapabilityVector } from '../search/vectorize-upsert';
import { buildAuthoritativeEdges, reviewedAliasEdge } from './capability-graph';
import type { GraphEdge } from './capability-graph';
import { bumpCatalogGeneration } from './catalog-generation';
import { writeGraphAdjacency } from './graph-hot';

const reviewedAliasesFromContract = (contract: unknown): string[] => {
  if (!contract || typeof contract !== 'object') {
    return [];
  }
  const { reviewedAliases } = contract as { reviewedAliases?: unknown };
  if (!Array.isArray(reviewedAliases)) {
    return [];
  }
  return reviewedAliases.filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
};

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
  const generation = await bumpCatalogGeneration(
    input.hot,
    input.doc.organizationId
  );
  const contract =
    input.doc.contract && typeof input.doc.contract === 'object'
      ? (input.doc.contract as Record<string, unknown>)
      : {};
  const edges: GraphEdge[] = [
    ...buildAuthoritativeEdges({
      capabilityId,
      contract,
      generation,
      handle: input.doc.handle,
      organizationId: input.doc.organizationId,
      packageSlug: input.doc.packageSlug,
      secretNames: input.secretNames ?? [],
      sourceKind: input.doc.sourceKind ?? 'hosted_function',
    }),
    ...reviewedAliasesFromContract(contract).map((alias) =>
      reviewedAliasEdge({
        alias,
        capabilityId,
        generation,
        organizationId: input.doc.organizationId ?? '',
      })
    ),
  ];
  await writeGraphAdjacency(input.hot, edges);
  await enqueueCapabilityVector({
    capabilityId,
    hot: input.hot,
    organizationId: input.doc.organizationId,
    projectionText: input.doc.searchText,
  });
};
