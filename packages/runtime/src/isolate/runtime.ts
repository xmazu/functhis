/**
 * Code injected into user Dynamic Workers as `./__functhis_runtime.mjs`.
 * After edits, run `bun run build` in `@functhis/runtime` (regenerates
 * `isolate-module.generated.ts` for MCP/CLI inject).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface FuncthisInvocationContext {
  callerUserId: string | null;
  executionId: string;
  functionSlug: string;
  packageVersionId: string;
}

export interface RuntimeStore {
  context: FuncthisInvocationContext;
  hostAllowlist?: readonly string[];
  secrets: Record<string, string>;
}

const __functhisRuntimeStorage = new AsyncLocalStorage<RuntimeStore>();

export const __runInRuntime = (
  store: RuntimeStore,
  fn: () => unknown | Promise<unknown>
): Promise<unknown> =>
  __functhisRuntimeStorage.run(store, async () => await fn());

export const context = (): FuncthisInvocationContext => {
  const store = __functhisRuntimeStorage.getStore();
  if (!store) {
    throw new Error(
      'functhis:runtime context is not available outside an invocation'
    );
  }
  return store.context;
};

export const secret = (name: string): string => {
  const store = __functhisRuntimeStorage.getStore();
  if (!store) {
    throw new Error(
      'functhis:runtime secret is not available outside an invocation'
    );
  }
  const value = store.secrets[name];
  if (value === undefined) {
    throw new Error(
      `Secret "${name}" is not set. Set it on the package or organization, or pass --secret ${name}=... for local dev.`
    );
  }
  return value;
};

const requestUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

const hostAllowedForFetch = (
  url: string,
  allowlist: readonly string[] | undefined
): boolean => {
  if (allowlist === undefined) {
    return true;
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowlist.some((entry) => entry.toLowerCase() === hostname);
};

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((
  input: Parameters<typeof fetch>[0],
  init?: RequestInit
) => {
  const store = __functhisRuntimeStorage.getStore();
  if (store && !hostAllowedForFetch(requestUrl(input), store.hostAllowlist)) {
    return Promise.reject(
      new Error(
        `Outbound fetch to ${requestUrl(input)} is not on the package host allowlist.`
      )
    );
  }
  return originalFetch(input as never, init);
}) as typeof fetch;
