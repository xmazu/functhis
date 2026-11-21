import { AsyncLocalStorage } from 'node:async_hooks';

const inboundRequestSignal = new AsyncLocalStorage<AbortSignal>();

export const runWithInboundRequestSignal = <T>(
  signal: AbortSignal,
  fn: () => T
): T => inboundRequestSignal.run(signal, fn);

export const getInboundRequestSignal = (): AbortSignal | undefined =>
  inboundRequestSignal.getStore();
