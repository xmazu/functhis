import { describe, expect, test } from 'bun:test';

import { ExecutePayloadTooLargeError } from '@functhis/publish/quotas';

import { executeOwnedFunction } from './execute-owned';

const env = {} as Env;
const timing = { queueMs: 1, totalMs: 2, upstreamMs: 3 };

describe('executeOwnedFunction', () => {
  test('normalizes object arguments and maps a successful dispatch', async () => {
    const result = await executeOwnedFunction(
      env,
      'user',
      { arguments: { value: 1 }, id: '@owner/pkg/fn' },
      {
        dispatch: async (_env, caller, input) => {
          await Promise.resolve();
          expect(caller).toBe('user');
          expect(input.arguments).toEqual({ value: 1 });
          return {
            bodyText: '{"ok":true}',
            ok: true,
            status: 200,
            timing,
          };
        },
      }
    );
    expect(result).toEqual({
      ok: true,
      responseText: '{"ok":true}',
      status: 200,
      timing,
    });
  });

  test('drops non-object arguments and maps failures', async () => {
    const result = await executeOwnedFunction(
      env,
      null,
      { arguments: 'invalid', id: '@owner/pkg/fn' },
      {
        dispatch: async (_env, _caller, input) => {
          await Promise.resolve();
          expect(input.arguments).toBeUndefined();
          return {
            bodyText: '{"error":"bad"}',
            error: 'invalid_input' as const,
            issues: [{ message: 'bad', path: [] }],
            ok: false,
            status: 400,
            timing,
          };
        },
      }
    );
    expect(result).toEqual({
      error: 'invalid_input',
      issues: [{ message: 'bad', path: [] }],
      ok: false,
      status: 400,
      timing,
    });
  });

  test('rethrows payload size errors', async () => {
    await expect(
      executeOwnedFunction(
        env,
        null,
        { id: '@owner/pkg/fn' },
        {
          dispatch: async () => {
            await Promise.resolve();
            throw new ExecutePayloadTooLargeError(10);
          },
        }
      )
    ).rejects.toBeInstanceOf(ExecutePayloadTooLargeError);
  });
});
