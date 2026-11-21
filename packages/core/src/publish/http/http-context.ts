export interface HotKvBinding {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ) => Promise<void>;
}
