export interface MemoryHotKv {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ) => Promise<void>;
}

export const createMemoryHotKv = (): MemoryHotKv => {
  const store = new Map<string, string>();

  return {
    delete: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(store.get(key) ?? null),
    put: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};
