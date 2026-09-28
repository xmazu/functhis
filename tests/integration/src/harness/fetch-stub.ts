export type FetchStubHandler = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Response | Promise<Response>;

export const stubGlobalFetch = (handler: FetchStubHandler): (() => void) => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input, init) =>
    Promise.resolve(handler(input, init))) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
};
