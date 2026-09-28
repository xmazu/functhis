export type EdgeProvenance = 'authoritative' | 'inferred';

export type GraphEdgeType =
  | 'co_used'
  | 'credential_for'
  | 'executes_via'
  | 'exposes_action'
  | 'has_parameter'
  | 'namespace_contains'
  | 'org_owns_package'
  | 'package_contains'
  | 'reviewed_alias'
  | 'similar_to'
  | 'version_of';

export interface GraphEdge {
  confidence: number;
  fromId: string;
  generation: number;
  organizationId: string;
  provenance: EdgeProvenance;
  toId: string;
  type: GraphEdgeType;
  weight: number;
}

export interface GraphEdgeDraft {
  confidence: number;
  fromId: string;
  provenance: EdgeProvenance;
  toId: string;
  type: GraphEdgeType;
  weight: number;
}

const MAX_HOPS = 2;
const MAX_NEIGHBORS_PER_NODE = 8;

const hopFactor = (hop: number): number => (hop === 1 ? 0.15 : 0.05);

export const graphNeighborBonus = (input: {
  confidence: number;
  degree: number;
  hop: number;
  sourceReliability: number;
  weight: number;
}): number => {
  const degree = Math.max(1, input.degree);
  return (
    (input.weight *
      input.confidence *
      input.sourceReliability *
      hopFactor(input.hop)) /
    Math.log2(degree + 1)
  );
};

export const traverseGraphNeighbors = (
  edges: readonly GraphEdge[],
  seedIds: readonly string[],
  accessibleIds: ReadonlySet<string>
): Map<string, number> => {
  const byFrom = new Map<string, GraphEdge[]>();
  const degree = new Map<string, number>();
  for (const edge of edges) {
    const list = byFrom.get(edge.fromId) ?? [];
    list.push(edge);
    byFrom.set(edge.fromId, list);
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
  }

  const bonus = new Map<string, number>();
  const visited = new Set(seedIds);

  const walk = (ids: readonly string[], hop: number): void => {
    if (hop > MAX_HOPS) {
      return;
    }
    const next: string[] = [];
    for (const id of ids) {
      const neighbors = (byFrom.get(id) ?? [])
        .filter(
          (edge) =>
            accessibleIds.has(edge.toId) &&
            (edge.provenance === 'authoritative' || hop === 1)
        )
        .slice(0, MAX_NEIGHBORS_PER_NODE);
      for (const edge of neighbors) {
        if (edge.provenance === 'inferred' && !visited.has(edge.toId)) {
          continue;
        }
        const canNominate = edge.provenance === 'authoritative';
        if (canNominate && !visited.has(edge.toId)) {
          next.push(edge.toId);
          visited.add(edge.toId);
        }
        if (!canNominate && !visited.has(edge.toId)) {
          continue;
        }
        const added = graphNeighborBonus({
          confidence: edge.confidence,
          degree: degree.get(id) ?? 1,
          hop,
          sourceReliability: 1,
          weight: edge.weight,
        });
        bonus.set(edge.toId, (bonus.get(edge.toId) ?? 0) + added);
      }
    }
    if (next.length > 0) {
      walk(next, hop + 1);
    }
  };

  walk(seedIds, 1);
  for (const id of seedIds) {
    bonus.delete(id);
  }
  return bonus;
};

export const buildAuthoritativeEdges = (input: {
  capabilityId: string;
  contract: Record<string, unknown>;
  generation: number;
  handle: string;
  organizationId: string;
  packageSlug: string;
  secretNames: readonly string[];
  sourceKind: string;
}): GraphEdge[] => {
  const edges: GraphEdgeDraft[] = [];
  const packageId = `@${input.handle}/${input.packageSlug}`;
  const orgId = `@${input.handle}`;
  edges.push(
    {
      confidence: 1,
      fromId: orgId,
      provenance: 'authoritative',
      toId: packageId,
      type: 'org_owns_package',
      weight: 1,
    },
    {
      confidence: 1,
      fromId: packageId,
      provenance: 'authoritative',
      toId: input.capabilityId,
      type: 'package_contains',
      weight: 1,
    }
  );
  const segments = input.capabilityId.split('/').slice(2);
  if (segments.length > 1) {
    const namespaceId = `${packageId}/${segments.slice(0, -1).join('/')}`;
    edges.push({
      confidence: 1,
      fromId: namespaceId,
      provenance: 'authoritative',
      toId: input.capabilityId,
      type: 'namespace_contains',
      weight: 1,
    });
  }
  const action = segments.at(-1);
  if (action) {
    edges.push({
      confidence: 1,
      fromId: input.capabilityId,
      provenance: 'authoritative',
      toId: `action:${action}`,
      type: 'exposes_action',
      weight: 1,
    });
  }
  const schema = input.contract.inputSchema;
  if (schema && typeof schema === 'object' && 'properties' in schema) {
    const { properties } = schema as { properties?: Record<string, unknown> };
    for (const name of Object.keys(properties ?? {})) {
      edges.push({
        confidence: 1,
        fromId: input.capabilityId,
        provenance: 'authoritative',
        toId: `param:${name}`,
        type: 'has_parameter',
        weight: 1,
      });
    }
  }
  edges.push({
    confidence: 1,
    fromId: input.capabilityId,
    provenance: 'authoritative',
    toId: `source:${input.sourceKind}`,
    type: 'executes_via',
    weight: 1,
  });
  for (const name of input.secretNames) {
    edges.push({
      confidence: 1,
      fromId: `secret:${name}`,
      provenance: 'authoritative',
      toId: input.capabilityId,
      type: 'credential_for',
      weight: 1,
    });
  }
  return edges.map((edge) => ({
    ...edge,
    generation: input.generation,
    organizationId: input.organizationId,
  }));
};

export const reviewedAliasEdge = (input: {
  alias: string;
  capabilityId: string;
  generation: number;
  organizationId: string;
}): GraphEdge => ({
  confidence: 1,
  fromId: `alias:${input.alias.toLowerCase()}`,
  generation: input.generation,
  organizationId: input.organizationId,
  provenance: 'authoritative',
  toId: input.capabilityId,
  type: 'reviewed_alias',
  weight: 1,
});
