import { asHotKvBinding } from '../publish/catalog/hot-kv-binding';
import { VectorizeEmbeddingIndex } from '../publish/search/vectorize-index';
import { reconcileSearchIndexDebt } from '../publish/search/vectorize-upsert';
import type { McpBindings } from './bindings';

export const reconcileMcpSearchIndex = (
  bindings: McpBindings
): Promise<number> => {
  if (!bindings.CAPABILITY_VECTOR_INDEX) {
    return Promise.resolve(0);
  }
  const hot = asHotKvBinding(bindings.HOT);
  const index = new VectorizeEmbeddingIndex(bindings.CAPABILITY_VECTOR_INDEX);
  return reconcileSearchIndexDebt({ env: bindings, hot, index });
};
