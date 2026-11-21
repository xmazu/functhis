import type { HotFunctionDoc } from '../publish/catalog/hot-catalog';
import { StoredBundleLoadError } from '../publish/execution/bundle-load-error';
import { insertStartedExecutionRow } from '../publish/execution/execution-store';
import { validateContractInput } from '../publish/execution/validate-input';
import {
  finalizeExecute,
  loadStoredBundle,
  runDynamicWorker,
} from '../publish/execution/worker-execute';
import { HostedSecretError } from '../publish/secrets/secret-crypto';
import type { McpBindings } from './bindings';
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
  bindings: McpBindings,
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
    bundle = await loadStoredBundle(bindings, input.doc.bundleHash);
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

  const { catalog } = bindings;
  let runtimeSecrets: Record<string, string> = {};
  try {
    const secretNames =
      await catalog.runtimeSecrets.loadPackageVersionSecretNames(
        input.doc.versionId
      );
    runtimeSecrets = await catalog.runtimeSecrets.resolveRuntimeSecrets({
      encryptionKey: bindings.FUNCTHIS_SECRETS_KEY,
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
  await insertStartedExecutionRow(catalog.executionLog, {
    callerUserId: input.callerUserId,
    executionId,
    functionId: input.doc.functionId,
    organizationId: input.doc.organizationId,
    packageVersionId: input.doc.versionId,
    requestBytes: input.requestBytes,
    startedAt: new Date(),
  });

  const upstreamStarted = Date.now();
  const run = await runDynamicWorker(bindings, {
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
    bindings,
    {
      executionLog: catalog.executionLog,
      quota: catalog.quota,
    },
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
    input.parsedId.packageSlug
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
