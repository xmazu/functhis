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
