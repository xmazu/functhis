import type { HotKvBinding } from './http-context';

/** Adapts a Workers KV namespace to the publish HOT binding shape. */
export const asHotKvBinding = (kv: {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ) => Promise<void>;
}): HotKvBinding => ({
  delete: (key) => kv.delete(key),
  get: (key) => kv.get(key),
  put: (key, value, options) => kv.put(key, value, options),
});
