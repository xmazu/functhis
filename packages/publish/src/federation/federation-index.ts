import type { PackageVisibility } from '../catalog/package-visibility';
import { formatFunctionId } from '../function-id';
import {
  extractMeaningfulSearchTokens,
  foldSearchSynonyms,
} from '../search/search-lexical';
import {
  buildIntentPhrases,
  schemaPropertyNames,
  searchPhrasings,
} from '../search/search-projection';
import {
  GRAPH_BONUS_CAP,
  SEARCH_GRAPH_NEIGHBORS,
  SEARCH_GRAPH_SEED,
  SEARCH_LEXICAL_TOP,
  sourceReliability,
} from '../search/search-result';
import type {
  CapabilityAvailability,
  CapabilitySourceKind,
} from '../search/search-result';
import { buildAuthoritativeEdges, reviewedAliasEdge } from './capability-graph';

export const FEDERATION_INDEX_VERSION = 1;

/** Max neighbors stored per capability in the serialized adjacency. */
const FEDERATION_ADJACENCY_MAX = 8;
const FEDERATION_MAX_HOPS = 2;

const hopFactor = (hop: number): number => (hop === 1 ? 0.15 : 0.05);

/** Minimal doc shape the index is built from (HotFunctionDoc satisfies this). */
export interface FederationDoc {
  availability?: CapabilityAvailability;
  contract: unknown;
  functionSlug: string;
  handle: string;
  organizationId: string | null;
  ownerUserId: string;
  packageSlug: string;
  searchText: string;
  sourceKind?: CapabilitySourceKind;
  visibility: PackageVisibility;
}

export interface FederationCapability {
  availability: CapabilityAvailability;
  contract: unknown;
  functionSlug: string;
  handle: string;
  id: string;
  organizationId: string;
  ownerUserId: string;
  packageSlug: string;
  reliability: number;
  searchText: string;
  sourceKind: CapabilitySourceKind;
  visibility: PackageVisibility;
}

export interface FederationIndex {
  adjacency: number[][];
  aliases: Record<string, number[]>;
  capabilities: FederationCapability[];
  exact: Record<string, number>;
  postings: Record<string, [number, number][]>;
  scope: string;
  version: number;
}

export interface FederationQueryHit {
  capIdx: number;
  graphBonus: number;
  indexScore: number;
}

export interface FederationQueryResult {
  aliasHitIds: Set<number>;
  exactHitIds: Set<number>;
  ranked: FederationQueryHit[];
}

export { searchPhrasings } from '../search/search-projection';

const contractRecord = (contract: unknown): Record<string, unknown> =>
  contract && typeof contract === 'object'
    ? (contract as Record<string, unknown>)
    : {};

const reviewedAliasesFromContract = (contract: unknown): string[] => {
  const { reviewedAliases } = contractRecord(contract) as {
    reviewedAliases?: unknown;
  };
  if (!Array.isArray(reviewedAliases)) {
    return [];
  }
  return reviewedAliases.filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
};

const tokenizeFolded = (text: string): string[] =>
  foldSearchSynonyms(extractMeaningfulSearchTokens(text));

const bigrams = (tokens: readonly string[]): string[] => {
  const pairs: string[] = [];
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (first && second) {
      pairs.push(`${first} ${second}`);
    }
  }
  return pairs;
};

const FIELD_WEIGHT_ID = 4;
const FIELD_WEIGHT_ALIAS = 3.5;
const FIELD_WEIGHT_INTENT = 2.5;
const FIELD_WEIGHT_DESCRIPTION = 2;
const FIELD_WEIGHT_PARAM = 1.5;
const FIELD_WEIGHT_TEXT = 1;

const addTerms = (
  terms: Map<string, number>,
  text: string,
  weight: number
): void => {
  const tokens = tokenizeFolded(text);
  for (const token of [...tokens, ...bigrams(tokens)]) {
    const previous = terms.get(token) ?? 0;
    if (weight > previous) {
      terms.set(token, weight);
    }
  }
};

interface BuiltCapability {
  aliases: string[];
  capability: FederationCapability;
  terms: Map<string, number>;
  virtualNodes: string[];
}

const buildCapability = (doc: FederationDoc): BuiltCapability | null => {
  if (!doc.organizationId) {
    return null;
  }
  const { organizationId } = doc;
  const sourceKind = doc.sourceKind ?? 'hosted_function';
  const availability = doc.availability ?? 'ready';
  const id = formatFunctionId({
    functionSlug: doc.functionSlug,
    handle: doc.handle,
    packageSlug: doc.packageSlug,
  });
  const contract = contractRecord(doc.contract);
  const aliases = reviewedAliasesFromContract(doc.contract);
  const description =
    typeof contract.description === 'string' ? contract.description : '';
  const params = schemaPropertyNames(contract.inputSchema);
  const intents = buildIntentPhrases({
    contract,
    slug: doc.functionSlug,
  });

  const terms = new Map<string, number>();
  addTerms(
    terms,
    [id, doc.handle, doc.packageSlug, doc.functionSlug].join(' '),
    FIELD_WEIGHT_ID
  );
  if (description) {
    addTerms(terms, description, FIELD_WEIGHT_DESCRIPTION);
  }
  for (const intent of intents) {
    addTerms(terms, intent, FIELD_WEIGHT_INTENT);
  }
  for (const name of params) {
    addTerms(terms, name, FIELD_WEIGHT_PARAM);
  }
  for (const alias of aliases) {
    addTerms(terms, alias, FIELD_WEIGHT_ALIAS);
  }
  if (doc.searchText) {
    addTerms(terms, doc.searchText, FIELD_WEIGHT_TEXT);
  }

  const edges = [
    ...buildAuthoritativeEdges({
      capabilityId: id,
      contract,
      generation: 0,
      handle: doc.handle,
      organizationId,
      packageSlug: doc.packageSlug,
      secretNames: [],
      sourceKind,
    }),
    ...aliases.map((alias) =>
      reviewedAliasEdge({
        alias,
        capabilityId: id,
        generation: 0,
        organizationId,
      })
    ),
  ];
  const virtualNodes = [
    ...new Set(
      edges
        .map((edge) => edge.toId)
        .filter(
          (node) =>
            node.startsWith('action:') ||
            node.startsWith('param:') ||
            node.startsWith('alias:')
        )
    ),
    `@${doc.handle}/${doc.packageSlug}`,
  ];

  return {
    aliases,
    capability: {
      availability,
      contract: doc.contract,
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      id,
      organizationId,
      ownerUserId: doc.ownerUserId,
      packageSlug: doc.packageSlug,
      reliability: sourceReliability(sourceKind, availability),
      searchText: doc.searchText,
      sourceKind,
      visibility: doc.visibility,
    },
    terms,
    virtualNodes,
  };
};

export const buildFederationIndex = (
  scope: string,
  docs: readonly FederationDoc[]
): FederationIndex => {
  const byId = new Map<string, FederationDoc>();
  for (const doc of docs) {
    if (!doc.organizationId) {
      continue;
    }
    byId.set(
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      }),
      doc
    );
  }
  const built = [...byId.values()].flatMap((doc) => {
    const row = buildCapability(doc);
    return row ? [row] : [];
  });
  const count = built.length;

  const documentFrequency = new Map<string, number>();
  for (const row of built) {
    for (const term of row.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const idf = (term: string): number => {
    const df = documentFrequency.get(term) ?? 0;
    return Math.log(1 + count / (1 + df));
  };

  const capabilities = built.map((row) => row.capability);
  const exact: Record<string, number> = {};
  const aliasAccumulator = new Map<string, number[]>();
  const postingsAccumulator = new Map<string, [number, number][]>();
  for (const [capIdx, row] of built.entries()) {
    exact[row.capability.id.toLowerCase()] = capIdx;
    for (const alias of row.aliases) {
      const key = alias.toLowerCase();
      const bucket = aliasAccumulator.get(key) ?? [];
      bucket.push(capIdx);
      aliasAccumulator.set(key, bucket);
    }
    for (const [term, fieldWeight] of row.terms) {
      const weight =
        Math.round(
          fieldWeight * idf(term) * row.capability.reliability * 1000
        ) / 1000;
      if (weight <= 0) {
        continue;
      }
      const bucket = postingsAccumulator.get(term) ?? [];
      bucket.push([capIdx, weight]);
      postingsAccumulator.set(term, bucket);
    }
  }
  const aliases: Record<string, number[]> =
    Object.fromEntries(aliasAccumulator);
  const postings: Record<string, [number, number][]> =
    Object.fromEntries(postingsAccumulator);

  const byVirtualNode = new Map<string, number[]>();
  for (const [capIdx, row] of built.entries()) {
    for (const node of row.virtualNodes) {
      const bucket = byVirtualNode.get(node) ?? [];
      bucket.push(capIdx);
      byVirtualNode.set(node, bucket);
    }
  }
  const adjacency: number[][] = built.map((row, capIdx) => {
    const neighbors: number[] = [];
    const seen = new Set<number>([capIdx]);
    for (const node of row.virtualNodes) {
      for (const other of byVirtualNode.get(node) ?? []) {
        if (seen.has(other)) {
          continue;
        }
        seen.add(other);
        neighbors.push(other);
        if (neighbors.length >= FEDERATION_ADJACENCY_MAX) {
          break;
        }
      }
      if (neighbors.length >= FEDERATION_ADJACENCY_MAX) {
        break;
      }
    }
    return neighbors;
  });

  return {
    adjacency,
    aliases,
    capabilities,
    exact,
    postings,
    scope,
    version: FEDERATION_INDEX_VERSION,
  };
};

const capabilityToFederationDoc = (
  capability: FederationCapability
): FederationDoc => ({
  availability: capability.availability,
  contract: capability.contract,
  functionSlug: capability.functionSlug,
  handle: capability.handle,
  organizationId: capability.organizationId,
  ownerUserId: capability.ownerUserId,
  packageSlug: capability.packageSlug,
  searchText: capability.searchText,
  sourceKind: capability.sourceKind,
  visibility: capability.visibility,
});

/**
 * Merge fresh docs into an existing index without KV reads. Stored
 * capabilities keep their searchText, so untouched rows re-index with full
 * fidelity. Tombstoned docs stay in the blob until the next full rebuild;
 * the query path verifies top hits against HOT and drops missing docs.
 */
export const upsertFederationDocs = (
  scope: string,
  existing: FederationIndex | null,
  docs: readonly FederationDoc[]
): FederationIndex => {
  if (!existing || existing.version !== FEDERATION_INDEX_VERSION) {
    return buildFederationIndex(scope, docs);
  }
  const freshIds = new Set<string>();
  for (const doc of docs) {
    if (!doc.organizationId) {
      continue;
    }
    freshIds.add(
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      })
    );
  }
  if (freshIds.size === 0) {
    return existing;
  }
  const kept: FederationDoc[] = existing.capabilities
    .filter((capability) => !freshIds.has(capability.id))
    .map((capability) => capabilityToFederationDoc(capability));
  return buildFederationIndex(scope, [...kept, ...docs]);
};

/** Drop capabilities from a scope index (for example when library visibility is removed). */
export const removeFederationCapabilityIds = (
  scope: string,
  existing: FederationIndex | null,
  capabilityIds: readonly string[]
): FederationIndex | null => {
  if (!existing || capabilityIds.length === 0) {
    return existing;
  }
  const remove = new Set(capabilityIds);
  const kept = existing.capabilities.filter(
    (capability) => !remove.has(capability.id)
  );
  if (kept.length === existing.capabilities.length) {
    return existing;
  }
  return buildFederationIndex(
    scope,
    kept.map((capability) => capabilityToFederationDoc(capability))
  );
};

const spreadGraphBonus = (
  index: FederationIndex,
  seeds: readonly number[]
): Map<number, number> => {
  const bonus = new Map<number, number>();
  const visited = new Set(seeds);
  let frontier = [...seeds];
  for (let hop = 1; hop <= FEDERATION_MAX_HOPS; hop += 1) {
    const next: number[] = [];
    for (const capIdx of frontier) {
      const neighbors = index.adjacency[capIdx] ?? [];
      const degree = Math.max(1, neighbors.length);
      for (const neighbor of neighbors) {
        const added = hopFactor(hop) / Math.log2(degree + 1);
        bonus.set(neighbor, (bonus.get(neighbor) ?? 0) + added);
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) {
      break;
    }
  }
  for (const seed of seeds) {
    bonus.delete(seed);
  }
  for (const [capIdx, value] of bonus) {
    bonus.set(capIdx, Math.min(GRAPH_BONUS_CAP, value));
  }
  return bonus;
};

export const queryFederationIndex = (
  index: FederationIndex,
  input: {
    intents?: readonly string[];
    limit?: number;
    query?: string;
  }
): FederationQueryResult => {
  const trimmedQuery = input.query?.trim() ?? '';
  const phrasings = searchPhrasings(trimmedQuery, input.intents);
  const primaryQuery = phrasings[0] ?? '';
  const limit = input.limit ?? SEARCH_LEXICAL_TOP;

  const exactHitIds = new Set<number>();
  const exactKey = primaryQuery.toLowerCase();
  const exactIdx = index.exact[exactKey];
  if (exactIdx !== undefined) {
    exactHitIds.add(exactIdx);
  }

  const aliasHitIds = new Set<number>();
  const aliasHits = index.aliases[exactKey] ?? [];
  for (const capIdx of aliasHits) {
    aliasHitIds.add(capIdx);
  }

  const postingScores = new Map<number, number>();
  for (const phrasing of phrasings) {
    const tokens = tokenizeFolded(phrasing);
    const keys = [...tokens, ...bigrams(tokens)];
    const perPhrasing = new Map<number, number>();
    for (const key of keys) {
      for (const [capIdx, weight] of index.postings[key] ?? []) {
        perPhrasing.set(capIdx, (perPhrasing.get(capIdx) ?? 0) + weight);
      }
    }
    for (const [capIdx, score] of perPhrasing) {
      const previous = postingScores.get(capIdx) ?? 0;
      if (score > previous) {
        postingScores.set(capIdx, score);
      }
    }
  }

  const seeds = [...postingScores.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, SEARCH_GRAPH_SEED)
    .map(([capIdx]) => capIdx);
  const graphBonus = spreadGraphBonus(index, seeds);

  const totals = new Map<number, { graphBonus: number; post: number }>();
  for (const [capIdx, post] of postingScores) {
    totals.set(capIdx, {
      graphBonus: graphBonus.get(capIdx) ?? 0,
      post,
    });
  }
  for (const [capIdx, bonus] of graphBonus) {
    if (!totals.has(capIdx)) {
      totals.set(capIdx, { graphBonus: bonus, post: 0 });
    }
  }

  const ranked = [...totals.entries()]
    .map(([capIdx, scores]) => ({
      capIdx,
      graphBonus: scores.graphBonus,
      indexScore: scores.post + scores.graphBonus,
    }))
    .toSorted((left, right) => {
      if (right.indexScore !== left.indexScore) {
        return right.indexScore - left.indexScore;
      }
      return (index.capabilities[left.capIdx]?.id ?? '').localeCompare(
        index.capabilities[right.capIdx]?.id ?? ''
      );
    });

  const nominated = ranked.filter(
    (row) =>
      (postingScores.get(row.capIdx) ?? 0) > 0 ||
      aliasHitIds.has(row.capIdx) ||
      row.graphBonus > 0
  );
  const extraGraphIds = ranked
    .filter(
      (row) =>
        !postingScores.has(row.capIdx) &&
        !aliasHitIds.has(row.capIdx) &&
        row.graphBonus > 0
    )
    .slice(0, SEARCH_GRAPH_NEIGHBORS)
    .map((row) => row.capIdx);
  const extraSet = new Set(extraGraphIds);
  const kept = nominated.filter(
    (row, position) =>
      position < limit ||
      extraSet.has(row.capIdx) ||
      aliasHitIds.has(row.capIdx)
  );

  return { aliasHitIds, exactHitIds, ranked: kept };
};
