import { HOT_GEN_PREFIX } from '../catalog/hot-keys';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { buildAuthoritativeEdges, reviewedAliasEdge } from './capability-graph';
import type { GraphEdge } from './capability-graph';
import {
  readCatalogGeneration,
  writeCatalogGeneration,
} from './catalog-generation';
import {
  removeFederationCapabilityIds,
  upsertFederationDocs,
} from './federation-index';
import type { FederationDoc, FederationIndex } from './federation-index';

export type FederationScope =
  | { kind: 'library' }
  | { kind: 'org'; organizationId: string };

export const FEDERATION_BLOB_PREFIX = 'fed:v1:';
const FEDERATION_LIBRARY_GENERATION_KEY = `${HOT_GEN_PREFIX}library`;

export const federationScopeKey = (scope: FederationScope): string =>
  scope.kind === 'library' ? 'library' : scope.organizationId;

export const federationIndexHotKey = (
  scopeKey: string,
  generation: number
): string => `${FEDERATION_BLOB_PREFIX}${scopeKey}:${generation}`;

interface MemoEntry {
  generation: number;
  index: FederationIndex;
}

const indexMemo = new Map<string, MemoEntry>();

/** Test-only reset for the isolate-level index memo. */
export const clearFederationIndexMemo = (): void => {
  indexMemo.clear();
};

export const readFederationGeneration = async (
  hot: HotKvBinding,
  scope: FederationScope
): Promise<number> => {
  if (scope.kind === 'org') {
    return readCatalogGeneration(hot, scope.organizationId);
  }
  const raw = await hot.get(FEDERATION_LIBRARY_GENERATION_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFederationIndex = (raw: string | null): FederationIndex | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as FederationIndex;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.capabilities) ||
      !parsed.postings ||
      typeof parsed.postings !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Load the scope index, memoized per isolate by catalog generation. Warm
 * isolates serve from memory with zero KV reads for the blob; cold isolates
 * do one generation read plus one blob read.
 */
export const loadFederationIndex = async (
  hot: HotKvBinding,
  scope: FederationScope
): Promise<{ generation: number; index: FederationIndex } | null> => {
  const scopeKey = federationScopeKey(scope);
  const generation = await readFederationGeneration(hot, scope);
  if (generation <= 0) {
    return null;
  }
  const memoized = indexMemo.get(scopeKey);
  if (memoized && memoized.generation === generation) {
    return memoized;
  }
  const index = parseFederationIndex(
    await hot.get(federationIndexHotKey(scopeKey, generation))
  );
  if (!index) {
    return null;
  }
  const entry = { generation, index };
  indexMemo.set(scopeKey, entry);
  return entry;
};

const FEDERATION_WRITE_MAX_ATTEMPTS = 5;

const writeLibraryGeneration = async (
  hot: HotKvBinding,
  generation: number
): Promise<void> => {
  await hot.put(FEDERATION_LIBRARY_GENERATION_KEY, String(generation));
};

const writeScopeGeneration = async (
  hot: HotKvBinding,
  scope: FederationScope,
  generation: number
): Promise<void> => {
  await (scope.kind === 'org'
    ? writeCatalogGeneration(hot, scope.organizationId, generation)
    : writeLibraryGeneration(hot, generation));
};

const scopeWriteChains = new Map<string, Promise<void>>();

const runSerializedScopeWrite = (
  scopeKey: string,
  work: () => Promise<void>
): Promise<void> => {
  const previous = scopeWriteChains.get(scopeKey) ?? Promise.resolve();
  const next = (async () => {
    try {
      await previous;
    } catch {
      // Keep the per-scope chain alive after a failed write.
    }
    await work();
  })();
  scopeWriteChains.set(scopeKey, next);
  return next;
};

const publishFederationScopeIndex = async (
  hot: HotKvBinding,
  scope: FederationScope,
  nextIndex: FederationIndex,
  genBefore: number,
  previousGeneration: number | null
): Promise<void> => {
  const scopeKey = federationScopeKey(scope);
  const nextGeneration = genBefore + 1;
  await hot.put(
    federationIndexHotKey(scopeKey, nextGeneration),
    JSON.stringify(nextIndex)
  );
  await writeScopeGeneration(hot, scope, nextGeneration);
  const genAfter = await readFederationGeneration(hot, scope);
  if (genAfter !== nextGeneration) {
    await hot.delete(federationIndexHotKey(scopeKey, nextGeneration));
    throw new Error('federation generation race');
  }
  if (previousGeneration !== null && previousGeneration !== nextGeneration) {
    await hot.delete(federationIndexHotKey(scopeKey, previousGeneration));
  }
  indexMemo.set(scopeKey, { generation: nextGeneration, index: nextIndex });
};

const mergeScopeIndex = (
  scopeKey: string,
  previous: FederationIndex | null,
  scopeDocs: readonly FederationDoc[],
  removeIds: readonly string[]
): FederationIndex | null => {
  let nextIndex = previous;
  if (removeIds.length > 0) {
    nextIndex = removeFederationCapabilityIds(scopeKey, nextIndex, removeIds);
  }
  if (scopeDocs.length > 0) {
    nextIndex = upsertFederationDocs(scopeKey, nextIndex, scopeDocs);
  }
  return nextIndex;
};

const applyFederationScopeUpdate = async (
  hot: HotKvBinding,
  scope: FederationScope,
  scopeDocs: readonly FederationDoc[],
  removeIds: readonly string[]
): Promise<void> => {
  if (scopeDocs.length === 0 && removeIds.length === 0) {
    return;
  }
  const scopeKey = federationScopeKey(scope);
  await runSerializedScopeWrite(scopeKey, async () => {
    /* eslint-disable no-await-in-loop -- optimistic retry on generation races */
    for (
      let attempt = 0;
      attempt < FEDERATION_WRITE_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const genBefore = await readFederationGeneration(hot, scope);
      const previous =
        genBefore > 0 ? await loadFederationIndex(hot, scope) : null;
      if (previous && previous.generation !== genBefore) {
        indexMemo.delete(scopeKey);
        continue;
      }
      const nextIndex = mergeScopeIndex(
        scopeKey,
        previous?.index ?? null,
        scopeDocs,
        removeIds
      );
      if (!nextIndex) {
        return;
      }
      if (
        scopeDocs.length === 0 &&
        removeIds.length > 0 &&
        nextIndex === previous?.index
      ) {
        return;
      }
      const genCheck = await readFederationGeneration(hot, scope);
      if (genCheck !== genBefore) {
        continue;
      }
      try {
        await publishFederationScopeIndex(
          hot,
          scope,
          nextIndex,
          genBefore,
          previous?.generation ?? null
        );
        return;
      } catch {
        indexMemo.delete(scopeKey);
      }
    }
    /* eslint-enable no-await-in-loop */
    throw new Error(`federation index write failed for scope ${scopeKey}`);
  });
};

/**
 * Rebuild the federation index once per scope for a batch of changed docs.
 * Called after the HOT doc writes and domain indexes are updated (publish
 * finalize, OpenAPI sync, remote MCP sync). Per-doc work (vector debt)
 * stays in `projectCapabilityAfterHotWrite`.
 */
export const projectFederationDocs = async (
  hot: HotKvBinding,
  docs: readonly FederationDoc[]
): Promise<void> => {
  const byOrgScope = new Map<
    string,
    { docs: FederationDoc[]; scope: FederationScope }
  >();
  const libraryDocs: FederationDoc[] = [];
  const libraryRemoveIds: string[] = [];
  for (const doc of docs) {
    if (!doc.organizationId) {
      continue;
    }
    const capabilityId = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const orgScope: FederationScope = {
      kind: 'org',
      organizationId: doc.organizationId,
    };
    const orgKey = federationScopeKey(orgScope);
    const orgEntry = byOrgScope.get(orgKey) ?? { docs: [], scope: orgScope };
    orgEntry.docs.push(doc);
    byOrgScope.set(orgKey, orgEntry);
    if (doc.visibility === 'library') {
      libraryDocs.push(doc);
    } else {
      libraryRemoveIds.push(capabilityId);
    }
  }
  await Promise.all(
    [...byOrgScope.values()].map(({ docs: scopeDocs, scope }) =>
      applyFederationScopeUpdate(hot, scope, scopeDocs, [])
    )
  );
  await applyFederationScopeUpdate(
    hot,
    { kind: 'library' },
    libraryDocs,
    libraryRemoveIds
  );
};

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

/**
 * Dashboard helper: authoritative graph edges for capabilities from the
 * federation index (same edge builder as publish-time adjacency).
 */
export const loadFederationEdgesForCapabilities = async (
  hot: HotKvBinding,
  input: {
    capabilityIds: readonly string[];
    organizationId: string;
    secretNames?: readonly string[];
  }
): Promise<GraphEdge[]> => {
  const loaded = await loadFederationIndex(hot, {
    kind: 'org',
    organizationId: input.organizationId,
  });
  if (!loaded) {
    return [];
  }
  const wanted = new Set(input.capabilityIds);
  const secretNames = input.secretNames ?? [];
  const edges: GraphEdge[] = [];
  for (const capability of loaded.index.capabilities) {
    if (!wanted.has(capability.id)) {
      continue;
    }
    const contract =
      capability.contract && typeof capability.contract === 'object'
        ? (capability.contract as Record<string, unknown>)
        : {};
    edges.push(
      ...buildAuthoritativeEdges({
        capabilityId: capability.id,
        contract,
        generation: loaded.generation,
        handle: capability.handle,
        organizationId: capability.organizationId,
        packageSlug: capability.packageSlug,
        secretNames,
        sourceKind: capability.sourceKind,
      })
    );
    for (const alias of reviewedAliasesFromContract(contract)) {
      edges.push(
        reviewedAliasEdge({
          alias,
          capabilityId: capability.id,
          generation: loaded.generation,
          organizationId: capability.organizationId,
        })
      );
    }
  }
  return edges;
};
