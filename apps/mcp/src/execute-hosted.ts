import { createDb } from '@functhis/db';
import { StoredBundleLoadError } from '@functhis/publish/bundle-load-error';
import { insertStartedExecutionRow } from '@functhis/publish/execution-store';
import {
  loadPackageVersionSecretNames,
  resolveHostedRuntimeSecrets,
} from '@functhis/publish/hosted-secrets';
import type { HotFunctionDoc } from '@functhis/publish/hot-catalog';
import { HostedSecretError } from '@functhis/publish/secret-crypto';
import { validateContractInput } from '@functhis/publish/validate-input';
import {
  finalizeExecute,
  loadStoredBundle,
  runDynamicWorker,
} from '@functhis/publish/worker-execute';

import type { DispatchResult } from './execute-dispatch';

const advisoryOutputValidation = (
  doc: HotFunctionDoc,
  bodyText: string
): { ok: boolean } | undefined => {
  if (!doc.strictOutput) {
    return undefined;
  }
  const contract =
    typeof doc.contract === 'object' && doc.contract !== null
      ? (doc.contract as { outputSchema?: unknown })
      : {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false };
  }
  const value =
    typeof parsed === 'object' && parsed !== null && 'result' in parsed
      ? (parsed as { result: unknown }).result
      : parsed;
  return { ok: validateContractInput(contract.outputSchema, value).ok };
};

export const executeHostedAdapter = async (
  env: Env,
  input: {
    callerUserId: string | null;
    doc: HotFunctionDoc;
    parsedId: {
      functionSlug: string;
      handle: string;
      packageSlug: string;
    };
    requestBytes: number;
    runInput: unknown;
    searchId?: string;
    signal?: AbortSignal;
  }
): Promise<DispatchResult> => {
  const started = Date.now();
  const queueMs = 0;
  if (!input.doc.organizationId) {
    return {
      bodyText: JSON.stringify({ error: 'not_found' }),
      error: 'not_found',
      ok: false,
      status: 404,
      timing: {
        queueMs,
        totalMs: Date.now() - started,
        upstreamMs: 0,
      },
    };
  }

  let bundle;
  try {
    bundle = await loadStoredBundle(env, input.doc.bundleHash);
  } catch (error) {
    if (error instanceof StoredBundleLoadError) {
      return {
        bodyText: JSON.stringify({
          error:
            error.code === 'not_found'
              ? 'not_found'
              : 'Failed to load function bundle',
        }),
        error: error.code === 'not_found' ? 'not_found' : undefined,
        ok: false,
        status: error.code === 'not_found' ? 404 : 500,
        timing: {
          queueMs,
          totalMs: Date.now() - started,
          upstreamMs: 0,
        },
      };
    }
    throw error;
  }

  const database = await createDb(env);
  let runtimeSecrets: Record<string, string> = {};
  try {
    const secretNames = await loadPackageVersionSecretNames(
      database,
      input.doc.versionId
    );
    runtimeSecrets = await resolveHostedRuntimeSecrets(database, {
      encryptionKey: env.FUNCTHIS_SECRETS_KEY,
      organizationId: input.doc.organizationId,
      packageId: input.doc.packageId,
      secretNames,
    });
  } catch (error) {
    if (error instanceof HostedSecretError) {
      return {
        bodyText: JSON.stringify({ error: 'Failed to load package secrets' }),
        ok: false,
        status: 500,
        timing: {
          queueMs,
          totalMs: Date.now() - started,
          upstreamMs: 0,
        },
      };
    }
    throw error;
  }

  const executionId = crypto.randomUUID();
  await insertStartedExecutionRow(env, {
    callerUserId: input.callerUserId,
    executionId,
    functionId: input.doc.functionId,
    organizationId: input.doc.organizationId,
    packageVersionId: input.doc.versionId,
    requestBytes: input.requestBytes,
    searchId: input.searchId,
    startedAt: new Date(),
  });

  const upstreamStarted = Date.now();
  const run = await runDynamicWorker(env, {
    bundle,
    callerUserId: input.callerUserId,
    executionId,
    functionSlug: input.parsedId.functionSlug,
    handle: input.parsedId.handle,
    hostAllowlist: input.doc.hostAllowlist ?? undefined,
    organizationId: input.doc.organizationId,
    packageSlug: input.parsedId.packageSlug,
    requestBytes: input.requestBytes,
    runInput: input.runInput,
    runtimeSecrets,
    signal: input.signal,
    versionId: input.doc.versionId,
  });
  const upstreamMs = Date.now() - upstreamStarted;

  const httpResponse = await finalizeExecute(
    env,
    {
      bundleHash: input.doc.bundleHash,
      callerUserId: input.callerUserId ?? undefined,
      functionSlug: input.parsedId.functionSlug,
      input: input.runInput,
      secretValues: Object.values(runtimeSecrets),
      versionId: input.doc.versionId,
    },
    run,
    input.doc.organizationId,
    input.doc.functionId,
    executionId,
    input.parsedId.handle,
    input.parsedId.packageSlug,
    input.searchId
  );
  const responseText = await httpResponse.text();
  if (run.status === 'cancelled') {
    return {
      bodyText: responseText,
      error: 'cancelled',
      ok: false,
      status: 499,
      timing: { queueMs, totalMs: Date.now() - started, upstreamMs },
    };
  }
  return {
    bodyText: responseText,
    ok: httpResponse.status < 400,
    status: httpResponse.status,
    timing: { queueMs, totalMs: Date.now() - started, upstreamMs },
    validation: advisoryOutputValidation(input.doc, responseText),
  };
};
