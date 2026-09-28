import { canAccessPackage } from '../catalog/catalog-access';
import {
  buildAccessContextFromHotKv,
  loadHotFunctionDocsFromKv,
} from '../catalog/hot-catalog';
import type { HotFunctionDoc, SearchDomain } from '../catalog/hot-catalog';
import {
  loadFederationIndex,
  readFederationGeneration,
} from '../federation/federation-hot';
import type { FederationScope } from '../federation/federation-hot';
import { queryFederationIndex } from '../federation/federation-index';
import type {
  FederationCapability,
  FederationIndex,
} from '../federation/federation-index';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { readOrgBoostMap } from './ranking-boost-kv';
import { toHit } from './search-fallback';
import { fuseSearchCandidates, selectFusedHits } from './search-fusion';
import { SEARCH_DEFAULT_LIMIT } from './search-result';
import type { SearchResult } from './search-result';

interface IndexCandidate {
  alias: boolean;
  boost: number;
  capability: FederationCapability;
  exact: boolean;
  generation: number;
  graphBonus: number;
  indexScore: number;
}

interface LoadedIndexScope {
  boosts: Record<string, number>;
  generation: number;
  index: FederationIndex;
}

const loadScopedIndexes = async (
  hot: HotKvBinding,
  scopes: readonly FederationScope[]
): Promise<LoadedIndexScope[]> => {
  const settled = await Promise.all(
    scopes.map(async (scope) => {
      const [index, boosts] = await Promise.all([
        loadFederationIndex(hot, scope),
        scope.kind === 'org'
          ? readOrgBoostMap(hot, scope.organizationId)
          : Promise.resolve({} as Record<string, number>),
      ]);
      if (!index) {
        return null;
      }
      return {
        boosts,
        generation: index.generation,
        index: index.index,
      };
    })
  );
  return settled.filter((row): row is LoadedIndexScope => row !== null);
};

const applyIndexMatch = (
  byId: Map<string, IndexCandidate>,
  index: FederationIndex,
  boosts: Record<string, number>,
  generation: number,
  capIdx: number,
  patch: Partial<IndexCandidate>
): void => {
  const capability = index.capabilities[capIdx];
  if (!capability) {
    return;
  }
  const existing = byId.get(capability.id);
  if (existing) {
    Object.assign(existing, patch);
    return;
  }
  byId.set(capability.id, {
    alias: false,
    boost: boosts[capability.id] ?? 0,
    capability,
    exact: false,
    generation,
    graphBonus: 0,
    indexScore: 0,
    ...patch,
  });
};

const mergeIndexMatches = (
  loaded: readonly LoadedIndexScope[],
  query: { intents?: readonly string[]; query: string }
): Map<string, IndexCandidate> => {
  const byId = new Map<string, IndexCandidate>();
  for (const { boosts, generation, index } of loaded) {
    const matches = queryFederationIndex(index, {
      intents: query.intents,
      query: query.query,
    });
    for (const capIdx of matches.exactHitIds) {
      applyIndexMatch(byId, index, boosts, generation, capIdx, {
        exact: true,
      });
    }
    for (const capIdx of matches.aliasHitIds) {
      applyIndexMatch(byId, index, boosts, generation, capIdx, {
        alias: true,
      });
    }
    for (const hit of matches.ranked) {
      const capability = index.capabilities[hit.capIdx];
      if (!capability) {
        continue;
      }
      const existing = byId.get(capability.id);
      if (existing && hit.indexScore <= existing.indexScore) {
        continue;
      }
      applyIndexMatch(byId, index, boosts, generation, hit.capIdx, {
        graphBonus: hit.graphBonus,
        indexScore: hit.indexScore,
      });
    }
  }
  return byId;
};

const filterAccessibleCandidates = (
  byId: Map<string, IndexCandidate>,
  domain: SearchDomain,
  callerUserId: string,
  accessContext: {
    organizationIds: readonly string[];
    userId: string | null;
  }
): IndexCandidate[] =>
  [...byId.values()].filter((row) => {
    if (domain === 'mine' && row.capability.ownerUserId !== callerUserId) {
      return false;
    }
    return canAccessPackage(
      {
        organizationId: row.capability.organizationId,
        ownerUserId: row.capability.ownerUserId,
        visibility: row.capability.visibility,
      },
      accessContext
    );
  });

const hotDocAccessible = (
  doc: HotFunctionDoc,
  domain: SearchDomain,
  callerUserId: string,
  accessContext: {
    organizationIds: readonly string[];
    userId: string | null;
  }
): boolean => {
  if (domain === 'mine' && doc.ownerUserId !== callerUserId) {
    return false;
  }
  return canAccessPackage(
    {
      organizationId: doc.organizationId,
      ownerUserId: doc.ownerUserId,
      visibility: doc.visibility,
    },
    accessContext
  );
};

export interface IndexSearchOutcome {
  generation: number;
  organizationId: string;
  result: Omit<SearchResult, 'searchId' | 'timing'>;
}

const runExactIndexHit = async (
  hot: HotKvBinding,
  accessible: readonly IndexCandidate[],
  primaryQuery: string,
  domain: SearchDomain,
  callerUserId: string,
  accessContext: {
    organizationIds: readonly string[];
    userId: string | null;
  }
): Promise<IndexSearchOutcome | null> => {
  if (!primaryQuery.startsWith('@')) {
    return null;
  }
  const exactHits = accessible.filter((row) => row.exact);
  if (exactHits.length !== 1) {
    return null;
  }
  const [hit] = exactHits;
  if (!hit) {
    return null;
  }
  const loaded = await loadHotFunctionDocsFromKv(hot, [hit.capability.id]);
  const [doc] = loaded;
  if (
    !doc?.organizationId ||
    !hotDocAccessible(doc, domain, callerUserId, accessContext)
  ) {
    return null;
  }
  const result = toHit(doc);
  return {
    generation: hit.generation,
    organizationId: doc.organizationId,
    result: {
      ambiguous: false,
      explanation: [
        {
          exactRank: 1,
          fusedScore: 1,
          graphBonus: 0,
          id: result.id,
          indexScore: hit.indexScore,
          usageBoost: 0,
        },
      ],
      reason: 'ok',
      results: [result],
    },
  };
};

const fuseAndVerifyIndexHits = async (
  hot: HotKvBinding,
  byId: Map<string, IndexCandidate>,
  accessible: readonly IndexCandidate[],
  domain: SearchDomain,
  callerUserId: string,
  accessContext: {
    organizationIds: readonly string[];
    userId: string | null;
  }
): Promise<IndexSearchOutcome | null> => {
  const ordered = accessible
    .filter((row) => row.indexScore > 0 || row.alias)
    .toSorted((left, right) => {
      if (right.indexScore !== left.indexScore) {
        return right.indexScore - left.indexScore;
      }
      return left.capability.id.localeCompare(right.capability.id);
    });
  if (ordered.length === 0) {
    return null;
  }
  const rankById = new Map(
    ordered.map((row, position) => [row.capability.id, position + 1])
  );
  const fused = fuseSearchCandidates(
    ordered.map((row) => ({
      exactRank: row.exact ? 1 : undefined,
      graphBonus: row.graphBonus,
      id: row.capability.id,
      lexicalRank:
        rankById.get(row.capability.id) ?? (row.alias ? 1 : undefined),
      usageBoost: row.boost,
    }))
  );
  const selected = selectFusedHits(fused, SEARCH_DEFAULT_LIMIT);
  if (selected.reason === 'no_match' || selected.ambiguous) {
    return null;
  }
  const verifiedDocs = await loadHotFunctionDocsFromKv(
    hot,
    selected.selected.map((row) => row.id)
  );
  const verifiedById = new Map(
    verifiedDocs.map((doc) => [
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      }),
      doc,
    ])
  );
  const rows = selected.selected.flatMap((row) => {
    const candidate = byId.get(row.id);
    const doc: HotFunctionDoc | undefined = verifiedById.get(row.id);
    if (
      !candidate ||
      !doc ||
      !hotDocAccessible(doc, domain, callerUserId, accessContext)
    ) {
      return [];
    }
    return [{ candidate, doc, fused: row }];
  });
  if (rows.length === 0) {
    return null;
  }
  const [firstRow] = rows;
  const organizationId = firstRow?.doc.organizationId ?? null;
  if (!organizationId) {
    return null;
  }
  let generation = 0;
  for (const { candidate, doc } of rows) {
    const { generation: candidateGeneration } = candidate;
    if (
      doc.organizationId === organizationId &&
      candidateGeneration > generation
    ) {
      generation = candidateGeneration;
    }
  }
  if (generation <= 0) {
    generation = await readFederationGeneration(hot, {
      kind: 'org',
      organizationId,
    });
  }
  return {
    generation,
    organizationId,
    result: {
      ambiguous: selected.ambiguous,
      explanation: rows.map((row) => ({
        exactRank: row.fused.exactRank,
        fusedScore: row.fused.fusedScore,
        graphBonus: row.fused.graphBonus,
        id: row.fused.id,
        indexScore: row.candidate.indexScore,
        lexicalRank: row.fused.lexicalRank,
        usageBoost: row.fused.usageBoost,
        vectorRank: row.fused.vectorRank,
      })),
      reason: selected.reason,
      results: rows.map((row) => toHit(row.doc)),
    },
  };
};

/** Federation index lookup, fusion, and HOT verification. */
export const runIndexSearch = async (
  hot: HotKvBinding,
  domain: SearchDomain,
  callerUserId: string,
  query: { intents?: readonly string[]; primaryQuery: string; query: string }
): Promise<IndexSearchOutcome | null> => {
  const accessContext = await buildAccessContextFromHotKv(hot, callerUserId);
  const scopes: FederationScope[] =
    domain === 'library'
      ? [{ kind: 'library' }]
      : accessContext.organizationIds.map((organizationId) => ({
          kind: 'org' as const,
          organizationId,
        }));
  if (scopes.length === 0) {
    return null;
  }
  const loaded = await loadScopedIndexes(hot, scopes);
  if (loaded.length === 0) {
    return null;
  }
  const byId = mergeIndexMatches(loaded, query);
  const accessible = filterAccessibleCandidates(
    byId,
    domain,
    callerUserId,
    accessContext
  );
  if (accessible.length === 0) {
    return null;
  }
  return (
    (await runExactIndexHit(
      hot,
      accessible,
      query.primaryQuery,
      domain,
      callerUserId,
      accessContext
    )) ??
    fuseAndVerifyIndexHits(
      hot,
      byId,
      accessible,
      domain,
      callerUserId,
      accessContext
    )
  );
};
