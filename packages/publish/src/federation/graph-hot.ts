import { adjacencyHotKey } from '../catalog/hot-keys';
import type { HotKvBinding } from '../http/http-context';
import type { GraphEdge } from './capability-graph';

export const writeAdjacencyEdges = async (
  hot: HotKvBinding,
  fromId: string,
  edges: readonly GraphEdge[]
): Promise<void> => {
  await hot.put(adjacencyHotKey(fromId), JSON.stringify(edges));
};

export const readAdjacencyEdges = async (
  hot: HotKvBinding,
  fromId: string
): Promise<GraphEdge[]> => {
  const raw = await hot.get(adjacencyHotKey(fromId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as GraphEdge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const deleteAdjacencyEdges = async (
  hot: HotKvBinding,
  fromId: string
): Promise<void> => {
  await hot.delete(adjacencyHotKey(fromId));
};

export const writeGraphAdjacency = async (
  hot: HotKvBinding,
  edges: readonly GraphEdge[]
): Promise<void> => {
  const byFrom = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const list = byFrom.get(edge.fromId) ?? [];
    list.push(edge);
    byFrom.set(edge.fromId, list);
  }
  await Promise.all(
    [...byFrom.entries()].map(([fromId, grouped]) =>
      writeAdjacencyEdges(hot, fromId, grouped)
    )
  );
};

export const loadGraphEdgesForSeeds = async (
  hot: HotKvBinding,
  seedIds: readonly string[]
): Promise<GraphEdge[]> => {
  const chunks = await Promise.all(
    seedIds.map((id) => readAdjacencyEdges(hot, id))
  );
  return chunks.flat();
};
