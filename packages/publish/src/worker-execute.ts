import { createDb } from '@functhis/db';
import { execution } from '@functhis/db/schema/catalog';
import {
  createRuntimeModuleSource,
  dynamicWorkerLoaderId,
  RUNTIME_MODULE_ID,
} from '@functhis/runtime';

import type { WorkerLoaderBundleShape } from './bundle';
import { bundleKvKey, utf8ByteLength } from './bundle';
import { StoredBundleLoadError } from './bundle-load-error';
import {
  EXECUTE_CPU_MS,
  EXECUTE_SUB_REQUESTS,
  WORKER_COMPATIBILITY_DATE,
} from './constants';
import {
  assertExecuteResponseSize,
  ExecutePayloadTooLargeError,
} from './quotas';
import type { RuntimeExecuteBody } from './schemas';

export interface ExecuteAnalyticsBinding {
  writeDataPoint: (input: {
    blobs: string[];
    doubles: number[];
    indexes: string[];
  }) => void;
}

export interface ExecuteBundlesKv {
  get: (key: string) => Promise<string | null>;
}

export interface ExecuteWorkerLoader {
  get: (
    id: string,
    factory: () => {
      compatibilityDate: string;
      compatibilityFlags?: string[];
      env: Record<string, never>;
      limits: { cpuMs: number; subRequests: number };
      mainModule: string;
      modules: Record<string, string>;
    }
  ) => {
    getEntrypoint: (
      name: undefined,
      opts: { limits: { cpuMs: number; subRequests: number } }
    ) => { fetch: (request: Request) => Promise<Response> };
  };
}

type DatabaseEnv = Parameters<typeof createDb>[0];

export type WorkerExecuteBindings = DatabaseEnv & {
  ANALYTICS: ExecuteAnalyticsBinding;
  BUNDLES: ExecuteBundlesKv;
  LOADER: ExecuteWorkerLoader;
};

export const loadStoredBundle = async (
  bindings: Pick<WorkerExecuteBindings, 'BUNDLES'>,
  bundleHash: string
): Promise<WorkerLoaderBundleShape> => {
  const kvKey = bundleKvKey(bundleHash);
  const stored = await bindings.BUNDLES.get(kvKey);
  if (!stored) {
    throw new StoredBundleLoadError('not_found', bundleHash);
  }
  try {
    return JSON.parse(stored) as WorkerLoaderBundleShape;
  } catch {
    throw new StoredBundleLoadError('invalid', bundleHash);
  }
};

export const writeExecutionAnalytics = (
  bindings: Pick<WorkerExecuteBindings, 'ANALYTICS'>,
  input: {
    callerUserId?: string;
    durationMs: number;
    functionSlug?: string;
    requestBytes: number;
    responseBytes: number;
    status: string;
    versionId: string;
  }
): void => {
  bindings.ANALYTICS.writeDataPoint({
    blobs: [input.versionId, input.functionSlug ?? '', input.status],
    doubles: [input.durationMs, input.requestBytes, input.responseBytes],
    indexes: [input.callerUserId ?? 'anonymous'],
  });
};

export const insertExecutionRow = async (
  bindings: WorkerExecuteBindings,
  input: {
    callerUserId?: string | null;
    cpuMs: number;
    functionId?: string;
    packageVersionId: string;
    requestBytes: number;
    responseBytes: number;
    status: string;
  }
): Promise<void> => {
  try {
    const database = await createDb(bindings);
    await database.insert(execution).values({
      callerUserId: input.callerUserId ?? null,
      cpuMs: input.cpuMs,
      functionId: input.functionId,
      packageVersionId: input.packageVersionId,
      requestBytes: input.requestBytes,
      responseBytes: input.responseBytes,
      status: input.status,
    });
  } catch {
    // Best-effort execution row.
  }
};

export interface DynamicRunResult {
  durationMs: number;
  httpStatus: number;
  requestBytes: number;
  responseBytes: number;
  responseText: string;
  status: string;
  tooLarge: boolean;
}

export const runDynamicWorker = async (
  bindings: Pick<WorkerExecuteBindings, 'LOADER'>,
  input: {
    bundle: WorkerLoaderBundleShape;
    callerUserId?: string | null;
    functionSlug?: string;
    requestBytes: number;
    runInput: unknown;
    runtimeSecrets?: Record<string, string>;
    versionId: string;
  }
): Promise<DynamicRunResult> => {
  const limits = {
    cpuMs: EXECUTE_CPU_MS,
    subRequests: EXECUTE_SUB_REQUESTS,
  };

  const functionSlug = input.functionSlug ?? '';
  const executionId = crypto.randomUUID();

  const worker = bindings.LOADER.get(
    dynamicWorkerLoaderId(input.versionId),
    () => ({
      compatibilityDate: WORKER_COMPATIBILITY_DATE,
      compatibilityFlags: ['nodejs_compat'],
      env: {},
      limits,
      mainModule: input.bundle.mainModule,
      modules: {
        ...input.bundle.modules,
        [RUNTIME_MODULE_ID]: createRuntimeModuleSource(),
      },
    })
  );

  const entrypoint = worker.getEntrypoint(undefined, { limits });
  const runRequest = new Request('https://worker.internal/run', {
    body: JSON.stringify({
      functionSlug: input.functionSlug,
      input: input.runInput ?? {},
      runtime: {
        context: {
          callerUserId: input.callerUserId ?? null,
          executionId,
          functionSlug,
          packageVersionId: input.versionId,
        },
        secrets: input.runtimeSecrets ?? {},
      },
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  const startedAt = Date.now();
  let status = 'ok';
  let httpStatus = 200;
  let responseText = '';
  let responseBytes = 0;
  let tooLarge = false;

  try {
    const workerResponse = await entrypoint.fetch(runRequest);
    responseText = await workerResponse.text();
    responseBytes = utf8ByteLength(responseText);
    httpStatus = workerResponse.status;
    if (!workerResponse.ok) {
      status = 'error';
    }
    assertExecuteResponseSize(responseText);
  } catch (error) {
    status = 'error';
    httpStatus = 500;
    if (error instanceof ExecutePayloadTooLargeError) {
      tooLarge = true;
      httpStatus = 413;
      responseText = JSON.stringify({ error: 'too_large' });
    } else {
      responseText = JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    responseBytes = utf8ByteLength(responseText);
  }

  return {
    durationMs: Date.now() - startedAt,
    httpStatus,
    requestBytes: input.requestBytes,
    responseBytes,
    responseText,
    status,
    tooLarge,
  };
};

export const finalizeExecute = async (
  bindings: WorkerExecuteBindings,
  parsed: RuntimeExecuteBody,
  run: DynamicRunResult,
  functionId?: string
): Promise<Response> => {
  writeExecutionAnalytics(bindings, {
    callerUserId: parsed.callerUserId,
    durationMs: run.durationMs,
    functionSlug: parsed.functionSlug,
    requestBytes: run.requestBytes,
    responseBytes: run.responseBytes,
    status: run.status,
    versionId: parsed.versionId,
  });

  await insertExecutionRow(bindings, {
    callerUserId: parsed.callerUserId,
    cpuMs: run.durationMs,
    functionId,
    packageVersionId: parsed.versionId,
    requestBytes: run.requestBytes,
    responseBytes: run.responseBytes,
    status: run.status,
  });

  if (run.tooLarge) {
    return Response.json({ error: 'too_large' }, { status: 413 });
  }

  return new Response(run.responseText, {
    headers: { 'content-type': 'application/json' },
    status: run.httpStatus,
  });
};
