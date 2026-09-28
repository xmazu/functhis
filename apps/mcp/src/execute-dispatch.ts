/* eslint-disable complexity -- execute dispatcher fans out hosted, OpenAPI, and remote MCP */
import { createDb } from '@functhis/db';
import { canAccessPackage } from '@functhis/publish/catalog-access';
import { parseFunctionId } from '@functhis/publish/function-id';
import {
  buildAccessContextFromHot,
  resolveHotFunctionDoc,
} from '@functhis/publish/hot-catalog';
import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import {
  createIdempotencyRequestHash,
  resolveIdempotency,
} from '@functhis/publish/idempotency';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  loadIdempotencyRecord,
} from '@functhis/publish/idempotency-store';
import { OrgQuotaExceededError } from '@functhis/publish/org-entitlements';
import { reserveOrgExecution } from '@functhis/publish/org-usage';
import {
  assertExecuteRequestSize,
  executeRequestByteLength,
} from '@functhis/publish/quotas';
import { persistSearchSelection } from '@functhis/publish/search-analytics';
import { validateContractInput } from '@functhis/publish/validate-input';
import type { ContractInputValidationIssue } from '@functhis/publish/validate-input';

import {
  executeOpenApiAdapter,
  executeRemoteMcpAdapter,
} from './execute-federated';
import { executeHostedAdapter } from './execute-hosted';
import { getInboundRequestSignal } from './inbound-request-signal';

export class FunctionNotFoundError extends Error {
  constructor() {
    super('Function not found');
    this.name = 'FunctionNotFoundError';
  }
}

export interface DispatchInput {
  arguments?: Record<string, unknown>;
  id: string;
  idempotencyKey?: string;
  searchId?: string;
}

export interface DispatchResult {
  bodyText: string;
  error?:
    | 'cancelled'
    | 'invalid_input'
    | 'not_found'
    | 'payload_too_large'
    | 'source_unavailable'
    | 'timeout';
  issues?: ContractInputValidationIssue[];
  ok: boolean;
  retryable?: boolean;
  status: number;
  timing: { queueMs: number; totalMs: number; upstreamMs: number };
  validation?: { ok: boolean };
}

const jsonError = (
  started: number,
  message: string,
  status: number,
  extra?: Partial<DispatchResult>
): DispatchResult => ({
  bodyText: JSON.stringify({ error: message }),
  ok: false,
  status,
  timing: { queueMs: 0, totalMs: Date.now() - started, upstreamMs: 0 },
  ...extra,
});

const selectionOutcome = (
  result: DispatchResult
): 'failed' | 'succeeded' | 'unavailable' => {
  if (result.error === 'source_unavailable') {
    return 'unavailable';
  }
  if (result.ok) {
    return 'succeeded';
  }
  return 'failed';
};

export const dispatchExecute = async (
  env: Env,
  callerUserId: string | null,
  input: DispatchInput
): Promise<DispatchResult> => {
  const started = Date.now();
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
  const signal = getInboundRequestSignal();

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
  if (!row.organizationId) {
    throw new FunctionNotFoundError();
  }

  const availability = row.availability ?? 'ready';
  if (availability === 'unavailable') {
    return jsonError(started, 'source_unavailable', 503, {
      error: 'source_unavailable',
      retryable: true,
    });
  }

  const contract =
    row.contract && typeof row.contract === 'object'
      ? (row.contract as Record<string, unknown>)
      : null;
  const validation = validateContractInput(contract?.inputSchema, runInput);
  if (!validation.ok) {
    return jsonError(started, 'invalid_input', 400, {
      bodyText: JSON.stringify({
        error: 'invalid_input',
        issues: validation.issues,
      }),
      error: 'invalid_input',
      issues: validation.issues,
    });
  }

  if (input.idempotencyKey) {
    const requestHash = await createIdempotencyRequestHash({
      arguments: runInput,
      id: input.id,
    });
    const existing = await loadIdempotencyRecord(
      database,
      row.organizationId,
      input.idempotencyKey
    );
    const decision = resolveIdempotency(existing, requestHash);
    if (decision.kind === 'mismatch') {
      return jsonError(started, 'idempotency_mismatch', 409);
    }
    if (decision.kind === 'in_progress') {
      return jsonError(started, 'invocation_in_progress', 409);
    }
    if (decision.kind === 'replay') {
      return {
        bodyText: decision.response.bodyText,
        ok: decision.response.status < 400,
        status: decision.response.status,
        timing: { queueMs: 0, totalMs: Date.now() - started, upstreamMs: 0 },
      };
    }
    await claimIdempotencyKey({
      database,
      key: input.idempotencyKey,
      organizationId: row.organizationId,
      requestHash,
    });
  }

  try {
    await reserveOrgExecution(database, row.organizationId);
  } catch (error) {
    if (error instanceof OrgQuotaExceededError) {
      return jsonError(started, error.message, 429);
    }
    throw error;
  }

  const sourceKind = row.sourceKind ?? 'hosted_function';
  let result: DispatchResult;
  if (sourceKind === 'openapi_operation') {
    result = await executeOpenApiAdapter(env, {
      callerUserId,
      doc: row,
      requestBytes,
      runInput,
      searchId: input.searchId,
      signal,
    });
  } else if (sourceKind === 'remote_mcp_tool') {
    result = await executeRemoteMcpAdapter(env, {
      callerUserId,
      doc: row,
      requestBytes,
      runInput,
      searchId: input.searchId,
      signal,
    });
  } else {
    result = await executeHostedAdapter(env, {
      callerUserId,
      doc: row,
      parsedId,
      requestBytes,
      runInput,
      searchId: input.searchId,
      signal,
    });
  }

  if (input.idempotencyKey && !signal?.aborted) {
    await completeIdempotencyKey({
      bodyText: result.bodyText,
      database,
      key: input.idempotencyKey,
      organizationId: row.organizationId,
      status: result.status,
    });
  }

  if (input.searchId) {
    await persistSearchSelection({
      capabilityId: input.id,
      database,
      hot,
      outcome: selectionOutcome(result),
      searchId: input.searchId,
    });
  }

  return result;
};
