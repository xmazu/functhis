import { createDb } from '@functhis/db';
import { StoredBundleLoadError } from '@functhis/publish/bundle-load-error';
import { canAccessPackage } from '@functhis/publish/catalog-access';
import { parseFunctionId } from '@functhis/publish/function-id';
import {
  buildAccessContextFromHot,
  resolveHotFunctionDoc,
} from '@functhis/publish/hot-catalog';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import {
  assertExecuteRequestSize,
  executeRequestByteLength,
} from '@functhis/publish/quotas';
import { validateContractInput } from '@functhis/publish/validate-input';
import type { ContractInputValidationIssue } from '@functhis/publish/validate-input';
import {
  finalizeExecute,
  loadStoredBundle,
  runDynamicWorker,
} from '@functhis/publish/worker-execute';

export class FunctionNotFoundError extends Error {
  constructor() {
    super('Function not found');
    this.name = 'FunctionNotFoundError';
  }
}

export interface ExecuteOwnedInput {
  arguments?: unknown;
  id: string;
}

export interface ExecuteOwnedSuccess {
  ok: true;
  responseText: string;
  status: number;
}

export interface ExecuteOwnedFailure {
  error: string;
  issues?: ContractInputValidationIssue[];
  ok: false;
  status: number;
}

export type ExecuteOwnedResult = ExecuteOwnedFailure | ExecuteOwnedSuccess;

export const executeOwnedFunction = async (
  env: Env,
  callerUserId: string | null,
  input: ExecuteOwnedInput
): Promise<ExecuteOwnedResult> => {
  const parsedId = parseFunctionId(input.id);
  if (!parsedId) {
    throw new FunctionNotFoundError();
  }

  const runInput = input.arguments ?? {};
  const requestBody = JSON.stringify({
    functionSlug: parsedId.functionSlug,
    input: runInput,
  });
  assertExecuteRequestSize(requestBody);
  const requestBytes = executeRequestByteLength(requestBody);

  const hot = asHotKvBinding(env.HOT);
  const database = await createDb(env);

  const [row, accessContext] = await Promise.all([
    resolveHotFunctionDoc(hot, database, parsedId),
    buildAccessContextFromHot(hot, database, callerUserId),
  ]);

  if (!row) {
    throw new FunctionNotFoundError();
  }

  if (
    !canAccessPackage(
      {
        organizationId: row.organizationId,
        ownerUserId: row.ownerUserId,
        visibility: row.visibility,
      },
      accessContext
    )
  ) {
    throw new FunctionNotFoundError();
  }

  const contract =
    row.contract && typeof row.contract === 'object'
      ? (row.contract as Record<string, unknown>)
      : null;
  const inputSchema = contract?.inputSchema;
  const validation = validateContractInput(inputSchema, runInput);
  if (!validation.ok) {
    return {
      error: 'invalid_input',
      issues: validation.issues,
      ok: false,
      status: 400,
    };
  }

  let bundle;
  try {
    bundle = await loadStoredBundle(env, row.bundleHash);
  } catch (error) {
    if (error instanceof StoredBundleLoadError) {
      if (error.code === 'not_found') {
        return {
          error: 'Function not found',
          ok: false,
          status: 404,
        };
      }
      return {
        error: 'Failed to load function bundle',
        ok: false,
        status: 500,
      };
    }
    throw error;
  }

  const run = await runDynamicWorker(env, {
    bundle,
    callerUserId,
    functionSlug: parsedId.functionSlug,
    requestBytes,
    runInput,
    versionId: row.versionId,
  });

  const executionCallerUserId = callerUserId ?? undefined;

  const httpResponse = await finalizeExecute(
    env,
    {
      bundleHash: row.bundleHash,
      callerUserId: executionCallerUserId,
      functionSlug: parsedId.functionSlug,
      input: runInput,
      versionId: row.versionId,
    },
    run,
    row.functionId
  );

  const responseText = await httpResponse.text();
  return {
    ok: true,
    responseText,
    status: httpResponse.status,
  };
};
