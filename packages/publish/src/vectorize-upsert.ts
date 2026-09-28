/* eslint-disable no-await-in-loop -- generation-aware Vectorize debt must apply in order */
import {
  deleteVectorEmbedFingerprint,
  recordVectorEmbedFingerprint,
  shouldSkipVectorEmbed,
} from './embed-fingerprints';
import { CAPABILITY_VECTOR_KIND, embedTexts } from './embedding';
import type { HotKvBinding } from './http-context';
import {
  clearSearchIndexDebt,
  listPendingSearchIndexDebtIds,
  markSearchIndexDebt,
  readSearchIndexDebt,
} from './search-index-debt';
import { buildEmbeddingInput } from './search-projection';
import type { EmbeddingIndex } from './vectorize-index';

export interface VectorizeUpsertEnv {
  AI?: {
    run: (
      model: '@cf/baai/bge-small-en-v1.5',
      input: { text: string[] }
    ) => Promise<{ data?: number[][] }>;
  };
  SENTRY_ENVIRONMENT?: string;
}

export const enqueueCapabilityVector = (input: {
  capabilityId: string;
  hot: HotKvBinding;
  organizationId: string;
  projectionText: string;
}): Promise<number> => {
  const embedText = buildEmbeddingInput({
    id: input.capabilityId,
    projectionText: input.projectionText,
  });
  return markSearchIndexDebt({
    capabilityId: input.capabilityId,
    embedText,
    hot: input.hot,
    organizationId: input.organizationId,
  });
};

export const reconcileSearchIndexDebt = async (input: {
  env: VectorizeUpsertEnv;
  hot: HotKvBinding;
  index: EmbeddingIndex;
}): Promise<number> => {
  const pending = await listPendingSearchIndexDebtIds(input.hot);
  let cleared = 0;
  for (const capabilityId of pending) {
    const debt = await readSearchIndexDebt(input.hot, capabilityId);
    if (!debt) {
      continue;
    }
    const metadata = {
      kind: CAPABILITY_VECTOR_KIND,
      organizationId: debt.organizationId,
    };
    const skip = await shouldSkipVectorEmbed({
      capabilityId,
      hot: input.hot,
      metadata,
      text: debt.embedText,
    });
    if (!skip) {
      try {
        const [values] = await embedTexts(input.env, [debt.embedText]);
        if (!values) {
          continue;
        }
        await input.index.upsert([
          {
            id: capabilityId,
            metadata,
            namespace: debt.organizationId,
            values,
          },
        ]);
        await recordVectorEmbedFingerprint({
          capabilityId,
          hot: input.hot,
          metadata,
          text: debt.embedText,
        });
      } catch {
        continue;
      }
    }
    if (
      await clearSearchIndexDebt({
        capabilityId,
        generation: debt.generation,
        hot: input.hot,
      })
    ) {
      cleared += 1;
    }
  }
  return cleared;
};

export const deleteCapabilityVectors = async (input: {
  hot: HotKvBinding;
  ids: readonly string[];
  index: EmbeddingIndex;
}): Promise<void> => {
  await input.index.deleteByIds(input.ids);
  await Promise.all(
    input.ids.map(async (id) => {
      await deleteVectorEmbedFingerprint(input.hot, id);
      const debt = await readSearchIndexDebt(input.hot, id);
      if (debt) {
        await clearSearchIndexDebt({
          capabilityId: id,
          generation: debt.generation,
          hot: input.hot,
        });
      }
    })
  );
};
