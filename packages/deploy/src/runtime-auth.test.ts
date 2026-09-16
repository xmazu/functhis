import { describe, expect, test } from 'bun:test';

import { RUNTIME_EXECUTE_SECRET_HEADER } from './constants';
import {
  isRuntimeExecuteAuthorized,
  runtimeExecuteSecretHeaders,
} from './runtime-auth';

describe('isRuntimeExecuteAuthorized', () => {
  test('accepts matching secret header', () => {
    const request = new Request('https://runtime/execute', {
      headers: { [RUNTIME_EXECUTE_SECRET_HEADER]: 'secret' },
    });
    expect(isRuntimeExecuteAuthorized(request, 'secret')).toBe(true);
  });

  test('rejects missing or wrong secret', () => {
    const request = new Request('https://runtime/execute');
    expect(isRuntimeExecuteAuthorized(request, 'secret')).toBe(false);
    expect(isRuntimeExecuteAuthorized(request)).toBe(false);
  });
});

describe('runtimeExecuteSecretHeaders', () => {
  test('returns header map for fetch', () => {
    expect(runtimeExecuteSecretHeaders('abc')).toEqual({
      [RUNTIME_EXECUTE_SECRET_HEADER]: 'abc',
    });
  });
});
