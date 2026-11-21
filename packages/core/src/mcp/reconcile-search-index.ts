import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import { VectorizeEmbeddingIndex } from '@functhis/publish/vectorize-index';
import { reconcileSearchIndexDebt } from '@functhis/publish/vectorize-upsert';

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
