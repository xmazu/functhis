import { describe, expect, test } from 'bun:test';

import { MAX_EXECUTE_REQUEST_BYTES } from '../constants';
import {
  assertExecuteRequestSize,
  assertExecuteResponseSize,
  executeRequestByteLength,
  ExecutePayloadTooLargeError,
} from './payload-limits';

describe('execute payload limits', () => {
  test('measures utf-8 request bytes', () => {
    expect(executeRequestByteLength('hello')).toBe(5);
    expect(executeRequestByteLength('é')).toBe(2);
  });

  test('allows payloads within protocol limits', () => {
    const body = 'x'.repeat(100);
    expect(() => assertExecuteRequestSize(body)).not.toThrow();
    expect(() => assertExecuteResponseSize(body)).not.toThrow();
  });

  test('rejects oversized request and response bodies', () => {
    const huge = 'x'.repeat(MAX_EXECUTE_REQUEST_BYTES + 1);
    expect(() => assertExecuteRequestSize(huge)).toThrow(
      ExecutePayloadTooLargeError
    );
    expect(() => assertExecuteResponseSize(huge)).toThrow(
      ExecutePayloadTooLargeError
    );
  });

  test('sets error metadata for request payloads', () => {
    const bytes = MAX_EXECUTE_REQUEST_BYTES + 42;
    try {
      assertExecuteRequestSize('x'.repeat(bytes));
    } catch (error) {
      expect(error).toBeInstanceOf(ExecutePayloadTooLargeError);
      if (error instanceof ExecutePayloadTooLargeError) {
        expect(error.kind).toBe('request');
        expect(error.maxBytes).toBe(MAX_EXECUTE_REQUEST_BYTES);
        expect(error.actualBytes).toBeGreaterThan(MAX_EXECUTE_REQUEST_BYTES);
      }
      return;
    }
    throw new Error('expected throw');
  });
});
