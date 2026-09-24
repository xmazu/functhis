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
      `Secret "${name}" is not set. Local dev: functhis run --secret ${name}=... . Hosted package secrets are not wired yet.`
    );
  }
  return value;
};
