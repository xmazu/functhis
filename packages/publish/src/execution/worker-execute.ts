import { createDb } from '@functhis/db';
import type { DatabaseConfig, SecretBinding } from '@functhis/db';
import {
  createRuntimeModuleSource,
  dynamicWorkerLoaderId,
  RUNTIME_MODULE_ID,
} from '@functhis/runtime';

import type { WorkerLoaderBundleShape } from '../bundle';
import { bundleKvKey, utf8ByteLength } from '../bundle';
import {
  EXECUTE_CPU_MS,
  EXECUTE_SUB_REQUESTS,
  WORKER_COMPATIBILITY_DATE,
} from '../constants';
import { limitsForPlan, resolveOrgPlan } from '../org/org-entitlements';
import {
  assertExecuteResponseSize,
  ExecutePayloadTooLargeError,
} from '../org/quotas';
import type { RuntimeExecuteBody } from '../schemas';
import {
  AXIOM_MAX_INPUT_BYTES,
  AXIOM_MAX_OUTPUT_BYTES,
  buildExecutionEvent,
  buildExecutionLifecycleLogs,
  capTelemetryValue,
  ingestAxiomEvents,
  resolveAxiomBindings,
} from '../telemetry/axiom';
import {
  AXIOM_REDACTION_MODULE_ID,
  AXIOM_TAIL_MODULE_ID,
  createAxiomRedactionModuleSource,
  createAxiomTailModuleSource,
} from '../telemetry/axiom-tail';
import { StoredBundleLoadError } from './bundle-load-error';
import { insertExecutionRow } from './execution-store';

export { insertStartedExecutionRow } from './execution-store';

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

interface WorkerLoaderJsModule {
  js: string;
}

const asWorkerLoaderJsModules = (
  modules: Record<string, string>
): Record<string, WorkerLoaderJsModule> => {
  const result: Record<string, WorkerLoaderJsModule> = {};
  for (const [name, source] of Object.entries(modules)) {
    result[name] = { js: source };
  }
  return result;
};

export interface ExecuteWorkerLoader {
  get: (
    id: string,
    factory: () => {
      compatibilityDate: string;
      compatibilityFlags?: string[];
      env: Record<string, string>;
      limits: { cpuMs: number; subRequests: number };
      mainModule: string;
      modules: Record<string, string | WorkerLoaderJsModule>;
      tails?: {
        fetch: (...args: never[]) => Promise<Response>;
      }[];
    }
  ) => {
    getEntrypoint: (
      name: undefined,
      opts: { limits: { cpuMs: number; subRequests: number } }
    ) => { fetch: (request: Request) => Promise<Response> };
  };
}

export type WorkerExecuteBindings = DatabaseConfig & {
  ANALYTICS: ExecuteAnalyticsBinding;
  AXIOM_API_TOKEN?: SecretBinding;
  AXIOM_DATASET?: string;
  AXIOM_EDGE?: string;
  AXIOM_EDGE_URL?: string;
  BUNDLES: ExecuteBundlesKv;
  FUNCTHIS_SKIP_AXIOM_TAIL?: string;
  LOADER: ExecuteWorkerLoader;
};

export const shouldSkipAxiomTail = (
  bindings: Pick<WorkerExecuteBindings, 'FUNCTHIS_SKIP_AXIOM_TAIL'>
): boolean =>
  bindings.FUNCTHIS_SKIP_AXIOM_TAIL === 'true' ||
  bindings.FUNCTHIS_SKIP_AXIOM_TAIL === '1';

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
    executionId: string;
    functionSlug?: string;
    organizationId: string;
    requestBytes: number;
    responseBytes: number;
    status: string;
    versionId: string;
  }
): void => {
  bindings.ANALYTICS.writeDataPoint({
    blobs: [
      input.executionId,
      input.versionId,
      input.functionSlug ?? '',
      input.status,
      input.callerUserId ?? '',
    ],
    doubles: [input.durationMs, input.requestBytes, input.responseBytes],
    indexes: [input.organizationId],
  });
};

/* c8 ignore start -- Worker/DB integration is covered by MCP integration tests. */
export interface DynamicRunResult {
  completedAt: Date;
  cpuMs: number;
  durationMs: number;
  httpStatus: number;
  requestBytes: number;
  responseBytes: number;
  responseText: string;
  startedAt: Date;
  status: string;
  tooLarge: boolean;
}

export const runDynamicWorker = async (
  bindings: Pick<
    WorkerExecuteBindings,
    | 'AXIOM_API_TOKEN'
    | 'AXIOM_DATASET'
    | 'AXIOM_EDGE'
    | 'AXIOM_EDGE_URL'
    | 'FUNCTHIS_SKIP_AXIOM_TAIL'
    | 'LOADER'
  >,
  input: {
    bundle: WorkerLoaderBundleShape;
    callerUserId?: string | null;
    executionId: string;
    functionSlug?: string;
    handle?: string;
    organizationId?: string;
    packageSlug?: string;
    requestBytes: number;
    runInput: unknown;
    runtimeSecrets?: Record<string, string>;
    hostAllowlist?: readonly string[];
    signal?: AbortSignal;
    versionId: string;
  }
): Promise<DynamicRunResult> => {
  const limits = {
    cpuMs: EXECUTE_CPU_MS,
    subRequests: EXECUTE_SUB_REQUESTS,
  };
  const functionSlug = input.functionSlug ?? '';
  const axiom = await resolveAxiomBindings(bindings);
  const attachAxiomTail = axiom !== null && !shouldSkipAxiomTail(bindings);

  const worker = bindings.LOADER.get(
    dynamicWorkerLoaderId(input.versionId),
    () => ({
      compatibilityDate: WORKER_COMPATIBILITY_DATE,
      compatibilityFlags: ['nodejs_compat'],
      env: {},
      limits,
      mainModule: input.bundle.mainModule,
      modules: asWorkerLoaderJsModules({
        ...input.bundle.modules,
        [RUNTIME_MODULE_ID]: createRuntimeModuleSource(),
      }),
      tails: attachAxiomTail
        ? [
            bindings.LOADER.get(`axiom-tail:${input.versionId}`, () => ({
              compatibilityDate: WORKER_COMPATIBILITY_DATE,
              compatibilityFlags: ['nodejs_compat'],
              env: {
                AXIOM_API_TOKEN: axiom.token,
                AXIOM_DATASET: axiom.dataset,
                AXIOM_EDGE: bindings.AXIOM_EDGE ?? '',
                HANDLE: input.handle ?? '',
                ORGANIZATION_ID: input.organizationId ?? '',
                PACKAGE_SLUG: input.packageSlug ?? '',
                REDACTION_SECRETS: JSON.stringify(
                  Object.values(input.runtimeSecrets ?? {})
                ),
                VERSION_ID: input.versionId,
              },
              limits,
              mainModule: AXIOM_TAIL_MODULE_ID,
              modules: {
                [AXIOM_REDACTION_MODULE_ID]: {
                  js: createAxiomRedactionModuleSource(),
                },
                [AXIOM_TAIL_MODULE_ID]: {
                  js: createAxiomTailModuleSource(),
                },
              },
            })).getEntrypoint(undefined, {
              limits,
            }) as unknown as {
              fetch: (...args: never[]) => Promise<Response>;
            },
          ]
        : undefined,
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
          executionId: input.executionId,
          functionSlug,
          packageVersionId: input.versionId,
        },
        hostAllowlist: input.hostAllowlist,
        secrets: input.runtimeSecrets ?? {},
      },
    }),
    headers: {
      'content-type': 'application/json',
      'x-functhis-execution-id': input.executionId,
      'x-functhis-function-slug': functionSlug,
    },
    method: 'POST',
    signal: input.signal,
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
    const aborted =
      input.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError');
    status = aborted ? 'cancelled' : 'error';
    httpStatus = aborted ? 499 : 500;
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

  const durationMs = Date.now() - startedAt;
  return {
    completedAt: new Date(),
    cpuMs: durationMs,
    durationMs,
    httpStatus,
    requestBytes: input.requestBytes,
    responseBytes,
    responseText,
    startedAt: new Date(startedAt),
    status,
    tooLarge,
  };
};
/* c8 ignore stop */

export const finalizeExecute = async (
  bindings: WorkerExecuteBindings,
  parsed: RuntimeExecuteBody & { secretValues?: readonly string[] },
  run: DynamicRunResult,
  organizationId: string,
  functionId: string | undefined,
  executionId: string,
  handle?: string,
  packageSlug?: string
): Promise<Response> => {
  writeExecutionAnalytics(bindings, {
    callerUserId: parsed.callerUserId,
    durationMs: run.durationMs,
    executionId,
    functionSlug: parsed.functionSlug,
    organizationId,
    requestBytes: run.requestBytes,
    responseBytes: run.responseBytes,
    status: run.status,
    versionId: parsed.versionId,
  });

  await insertExecutionRow(bindings, {
    callerUserId: parsed.callerUserId,
    completedAt: run.completedAt,
    cpuMs: run.cpuMs,
    executionId,
    functionId,
    organizationId,
    packageVersionId: parsed.versionId,
    requestBytes: run.requestBytes,
    responseBytes: run.responseBytes,
    startedAt: run.startedAt,
    status: run.status,
  });

  const output = (() => {
    try {
      return JSON.parse(run.responseText) as unknown;
    } catch {
      return run.responseText;
    }
  })();

  let logRetentionDays = 0;
  try {
    const database = await createDb(bindings);
    const plan = await resolveOrgPlan(database, organizationId);
    ({ logRetentionDays } = limitsForPlan(plan));
  } catch {
    // Best-effort plan lookup; execution response must still return.
  }
  if (logRetentionDays > 0) {
    const executionEvent = buildExecutionEvent({
      executionId,
      functionSlug: parsed.functionSlug,
      handle,
      input: capTelemetryValue(parsed.input, AXIOM_MAX_INPUT_BYTES),
      organizationId,
      output: capTelemetryValue(output, AXIOM_MAX_OUTPUT_BYTES),
      packageSlug,
      secretValues: parsed.secretValues,
      status: run.status,
      versionId: parsed.versionId,
    });
    await ingestAxiomEvents(bindings, [
      executionEvent,
      ...buildExecutionLifecycleLogs({
        completedAt: run.completedAt.toISOString(),
        executionId,
        functionSlug: parsed.functionSlug,
        handle,
        input: executionEvent.input,
        organizationId,
        output: executionEvent.output,
        packageSlug,
        startedAt: run.startedAt.toISOString(),
        status: run.status,
        versionId: parsed.versionId,
      }),
    ]);
  }

  if (run.tooLarge) {
    return Response.json({ error: 'too_large' }, { status: 413 });
  }

  return new Response(run.responseText, {
    headers: { 'content-type': 'application/json' },
    status: run.httpStatus,
  });
};
