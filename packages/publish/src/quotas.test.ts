import { describe, expect, test } from 'bun:test';

import { MAX_EXECUTE_REQUEST_BYTES } from './constants';
import {
  assertExecuteRequestSize,
  assertExecuteResponseSize,
  ExecutePayloadTooLargeError,
} from './quotas';

describe('execute size quotas', () => {
  test('accepts request at limit', () => {
    const body = 'a'.repeat(MAX_EXECUTE_REQUEST_BYTES);
    expect(() => assertExecuteRequestSize(body)).not.toThrow();
  });

  test('rejects oversized request', () => {
    const body = 'a'.repeat(MAX_EXECUTE_REQUEST_BYTES + 1);
    expect(() => assertExecuteRequestSize(body)).toThrow(
      ExecutePayloadTooLargeError
    );
  });

  test('rejects oversized response', () => {
    const body = 'x'.repeat(MAX_EXECUTE_REQUEST_BYTES + 1);
    expect(() => assertExecuteResponseSize(body)).toThrow(
      ExecutePayloadTooLargeError
    );
  });
});
