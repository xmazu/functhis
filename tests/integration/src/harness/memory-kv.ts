export interface MemoryBundles {
  bundles: { put: (key: string, value: string) => Promise<void> };
  get: (key: string) => string | undefined;
  keys: () => string[];
}

export const createMemoryStore = (): MemoryBundles => {
  const store = new Map<string, string>();

  return {
    bundles: {
      put: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    },
    get: (key: string) => store.get(key),
    keys: () => [...store.keys()],
  };
};

export const createMemoryBundles = (): MemoryBundles => createMemoryStore();
