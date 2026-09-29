import { ExecutePayloadTooLargeError } from '@functhis/publish/quotas';

import { dispatchExecute } from './execute-dispatch';
import type { DispatchResult } from './execute-dispatch';

export { FunctionNotFoundError } from './execute-dispatch';

export interface ExecuteOwnedInput {
  arguments?: unknown;
  id: string;
  idempotencyKey?: string;
}

export interface ExecuteOwnedSuccess {
  ok: true;
  responseText: string;
  status: number;
  timing: DispatchResult['timing'];
}

export interface ExecuteOwnedFailure {
  error: string;
  issues?: DispatchResult['issues'];
  ok: false;
  status: number;
  timing: DispatchResult['timing'];
}

export type ExecuteOwnedResult = ExecuteOwnedFailure | ExecuteOwnedSuccess;

export interface ExecuteOwnedDependencies {
  dispatch?: typeof dispatchExecute;
}

export const executeOwnedFunction = async (
  env: Env,
  callerUserId: string | null,
  input: ExecuteOwnedInput,
  dependencies: ExecuteOwnedDependencies = {}
): Promise<ExecuteOwnedResult> => {
  try {
    const result = await (dependencies.dispatch ?? dispatchExecute)(
      env,
      callerUserId,
      {
        arguments:
          input.arguments && typeof input.arguments === 'object'
            ? (input.arguments as Record<string, unknown>)
            : undefined,
        id: input.id,
        idempotencyKey: input.idempotencyKey,
      }
    );
    if (!result.ok) {
      return {
        error: result.error ?? result.bodyText,
        issues: result.issues,
        ok: false,
        status: result.status,
        timing: result.timing,
      };
    }
    return {
      ok: true,
      responseText: result.bodyText,
      status: result.status,
      timing: result.timing,
    };
  } catch (error) {
    if (error instanceof ExecutePayloadTooLargeError) {
      throw error;
    }
    throw error;
  }
};
