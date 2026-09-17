import { describe, expect, test } from 'bun:test';

import { handleInternalExecute } from './internal-execute';

const env = {
  INTERNAL_EXECUTE_TOKEN: 'test-token',
} as Env;

describe('handleInternalExecute', () => {
  test('rejects public hostname even with valid token', async () => {
    const response = await handleInternalExecute(
      new Request('https://mcp.functhis.now/internal/execute', {
        body: JSON.stringify({
          callerUserId: 'user-1',
          id: '@alice/pkg/fn',
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Functhis-Internal-Token': 'test-token',
        },
        method: 'POST',
      }),
      env
    );

    expect(response.status).toBe(404);
  });

  test('rejects missing internal token', async () => {
    const response = await handleInternalExecute(
      new Request('https://internal/internal/execute', {
        body: JSON.stringify({
          callerUserId: 'user-1',
          id: '@alice/pkg/fn',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      env
    );

    expect(response.status).toBe(401);
  });

  test('rejects invalid json', async () => {
    const response = await handleInternalExecute(
      new Request('https://internal/internal/execute', {
        body: '{',
        headers: {
          'Content-Type': 'application/json',
          'X-Functhis-Internal-Token': 'test-token',
        },
        method: 'POST',
      }),
      env
    );

    expect(response.status).toBe(400);
  });
});
