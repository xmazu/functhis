import { sha256Hex } from './bundle';
import {
  CAPABILITY_EMBEDDING_DIMENSIONS,
  CAPABILITY_EMBEDDING_MODEL,
} from './embedding';
import { embedFingerprintHotKey } from './hot-keys';
import type { HotKvBinding } from './http-context';
import { truncateEmbeddingInput } from './search-projection';

export const VECTOR_EMBED_FINGERPRINT_VERSION = 1;

export const vectorEmbedContentHash = (input: {
  metadata?: Record<string, string>;
  text: string;
}): Promise<string> => {
  const metadata = input.metadata
    ? JSON.stringify(
        Object.fromEntries(
          Object.keys(input.metadata)
            .toSorted()
            .map((key) => [key, input.metadata?.[key]])
        )
      )
    : '';
  return sha256Hex(
    [
      CAPABILITY_EMBEDDING_MODEL,
      String(CAPABILITY_EMBEDDING_DIMENSIONS),
      String(VECTOR_EMBED_FINGERPRINT_VERSION),
      truncateEmbeddingInput(input.text),
      metadata,
    ].join('\0')
  );
};

export const shouldSkipVectorEmbed = async (input: {
  capabilityId: string;
  hot: HotKvBinding;
  metadata?: Record<string, string>;
  text: string;
}): Promise<boolean> => {
  const stored = await input.hot.get(
    embedFingerprintHotKey(input.capabilityId)
  );
  if (!stored) {
    return false;
  }
  const next = await vectorEmbedContentHash({
    metadata: input.metadata,
    text: input.text,
  });
  return stored === next;
};

export const recordVectorEmbedFingerprint = async (input: {
  capabilityId: string;
  hot: HotKvBinding;
  metadata?: Record<string, string>;
  text: string;
}): Promise<void> => {
  const hash = await vectorEmbedContentHash({
    metadata: input.metadata,
    text: input.text,
  });
  await input.hot.put(embedFingerprintHotKey(input.capabilityId), hash);
};

export const deleteVectorEmbedFingerprint = async (
  hot: HotKvBinding,
  capabilityId: string
): Promise<void> => {
  await hot.delete(embedFingerprintHotKey(capabilityId));
};
