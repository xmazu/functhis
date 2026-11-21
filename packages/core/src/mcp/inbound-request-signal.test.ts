import { describe, expect, test } from 'bun:test';

import {
  getInboundRequestSignal,
  runWithInboundRequestSignal,
} from './inbound-request-signal';

describe('inbound request signal', () => {
  test('exposes the bound abort signal', () => {
    const controller = new AbortController();
    const bound = runWithInboundRequestSignal(controller.signal, () =>
      getInboundRequestSignal()
    );
    expect(bound).toBe(controller.signal);
    expect(getInboundRequestSignal()).toBeUndefined();
  });
});
