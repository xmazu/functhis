import { createDb } from '@functhis/db';
import { user } from '@functhis/db/schema/auth';
import { pkg, pkgFunction, packageVersion } from '@functhis/db/schema/catalog';
import {
  assertExecuteRequestSize,
  buildPackageAccessContext,
  canAccessPackage,
  executeRequestByteLength,
  finalizeExecute,
  loadStoredBundle,
  parseFunctionId,
  runDynamicWorker,
  StoredBundleLoadError,
  validateContractInput,
} from '@functhis/deploy';
import type { ContractInputValidationIssue } from '@functhis/deploy';
import { and, eq } from 'drizzle-orm';

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

  const database = await createDb(env);
  const accessContext = await buildPackageAccessContext(database, callerUserId);

  const [row] = await database
    .select({
      bundleHash: packageVersion.bundleHash,
      contract: pkgFunction.contract,
      functionId: pkgFunction.id,
      organizationId: pkg.organizationId,
      ownerUserId: pkg.ownerUserId,
      versionId: packageVersion.id,
      visibility: pkg.visibility,
    })
    .from(pkgFunction)
    .innerJoin(pkg, eq(pkgFunction.packageId, pkg.id))
    .innerJoin(user, eq(pkg.ownerUserId, user.id))
    .innerJoin(packageVersion, eq(pkg.currentVersionId, packageVersion.id))
    .where(
      and(
        eq(user.handle, parsedId.handle),
        eq(pkg.slug, parsedId.packageSlug),
        eq(pkgFunction.slug, parsedId.functionSlug)
      )
    )
    .limit(1);

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
