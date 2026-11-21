import type { HotFunctionDoc } from '../publish/catalog/hot-catalog';
import { asHotKvBinding } from '../publish/catalog/hot-kv-binding';
import {
  insertExecutionRow,
  insertStartedExecutionRow,
} from '../publish/execution/execution-store';
import { hostAllowedForFetch } from '../publish/sources/host-allowlist';
import { buildRemoteMcpCallToolRequest } from '../publish/sources/remote-mcp-protocol';
import { invalidateRemoteMcpSnapshot } from '../publish/sources/remote-mcp-sync';
import type { McpBindings } from './bindings';
import type { DispatchResult } from './execute-dispatch';

const interpolatePath = (
  template: string,
  args: Record<string, unknown>
): string =>
  template.replaceAll(/\{[^{}]+\}/gu, (match) =>
    encodeURIComponent(String(args[match.slice(1, -1)] ?? ''))
  );

const retryOnce = async (
  run: () => Promise<Response>,
  retryable: boolean
): Promise<Response> => {
  const first = await run();
  if (!retryable || (first.status !== 429 && first.status !== 503)) {
    return first;
  }
  return run();
};

const loadCredential = async (
  bindings: McpBindings,
  doc: HotFunctionDoc
): Promise<string | undefined> => {
  if (!doc.sourceCredentialName || !doc.organizationId) {
    return undefined;
  }
  const secrets = await bindings.catalog.runtimeSecrets.resolveRuntimeSecrets({
    encryptionKey: bindings.FUNCTHIS_SECRETS_KEY,
    organizationId: doc.organizationId,
    packageId: doc.packageId,
    secretNames: [doc.sourceCredentialName],
  });
  return secrets[doc.sourceCredentialName];
};

const finishExecution = async (
  bindings: McpBindings,
  input: {
    callerUserId: string | null;
    doc: HotFunctionDoc;
    requestBytes: number;
    responseText: string;
    started: number;
    status: number;
    upstreamMs: number;
  }
): Promise<void> => {
  if (!input.doc.organizationId) {
    return;
  }
  const executionId = crypto.randomUUID();
  await insertStartedExecutionRow(bindings.catalog.executionLog, {
    callerUserId: input.callerUserId,
    executionId,
    functionId: input.doc.functionId,
    organizationId: input.doc.organizationId,
    packageVersionId: input.doc.versionId,
    requestBytes: input.requestBytes,
    startedAt: new Date(input.started),
  });
  await insertExecutionRow(bindings.catalog.executionLog, {
    callerUserId: input.callerUserId,
    completedAt: new Date(),
    cpuMs: Date.now() - input.started,
    executionId,
    functionId: input.doc.functionId,
    organizationId: input.doc.organizationId,
    packageVersionId: input.doc.versionId,
    requestBytes: input.requestBytes,
    responseBytes: new TextEncoder().encode(input.responseText).length,
    startedAt: new Date(input.started),
    status: input.status >= 500 ? 'error' : 'ok',
  });
};

export const callOpenApiOperation = async (
  bindings: McpBindings,
  input: {
    callerUserId: string | null;
    doc: HotFunctionDoc;
    requestBytes: number;
    runInput: unknown;
    signal?: AbortSignal;
  }
): Promise<DispatchResult> => {
  const started = Date.now();
  const endpoint = input.doc.sourceEndpoint;
  const path = input.doc.sourcePath;
  if (!endpoint || !path) {
    return {
      bodyText: JSON.stringify({ error: 'source_unavailable' }),
      error: 'source_unavailable',
      ok: false,
      retryable: true,
      status: 503,
      timing: { queueMs: 0, totalMs: Date.now() - started, upstreamMs: 0 },
    };
  }
  const url = `${endpoint}${interpolatePath(
    path,
    (input.runInput ?? {}) as Record<string, unknown>
  )}`;
  if (!hostAllowedForFetch(url, [new URL(endpoint).hostname])) {
    return {
      bodyText: JSON.stringify({ error: 'source_unavailable' }),
      error: 'source_unavailable',
      ok: false,
      status: 500,
      timing: { queueMs: 0, totalMs: Date.now() - started, upstreamMs: 0 },
    };
  }
  const token = await loadCredential(bindings, input.doc);
  const method = (input.doc.sourceMethod ?? 'post').toUpperCase();
  const retryable = method === 'GET';
  const upstreamStarted = Date.now();
  let response: Response;
  try {
    response = await retryOnce(
      () =>
        fetch(url, {
          body:
            method === 'GET' || method === 'HEAD'
              ? undefined
              : JSON.stringify(input.runInput ?? {}),
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          method,
          signal: input.signal,
        }),
      retryable
    );
  } catch (error) {
    if (input.signal?.aborted) {
      return {
        bodyText: JSON.stringify({ error: 'cancelled' }),
        error: 'cancelled',
        ok: false,
        status: 499,
        timing: {
          queueMs: 0,
          totalMs: Date.now() - started,
          upstreamMs: Date.now() - upstreamStarted,
        },
      };
    }
    return {
      bodyText: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      error: 'source_unavailable',
      ok: false,
      retryable: true,
      status: 503,
      timing: {
        queueMs: 0,
        totalMs: Date.now() - started,
        upstreamMs: Date.now() - upstreamStarted,
      },
    };
  }
  const bodyText = await response.text();
  await finishExecution(bindings, {
    callerUserId: input.callerUserId,
    doc: input.doc,
    requestBytes: input.requestBytes,
    responseText: bodyText,
    started,
    status: response.status,
    upstreamMs: Date.now() - upstreamStarted,
  });
  return {
    bodyText,
    ok: response.ok,
    status: response.status,
    timing: {
      queueMs: 0,
      totalMs: Date.now() - started,
      upstreamMs: Date.now() - upstreamStarted,
    },
  };
};

export const callRemoteMcpTool = async (
  bindings: McpBindings,
  input: {
    callerUserId: string | null;
    doc: HotFunctionDoc;
    requestBytes: number;
    runInput: unknown;
    signal?: AbortSignal;
  }
): Promise<DispatchResult> => {
  const started = Date.now();
  const endpoint = input.doc.sourceEndpoint;
  if (!endpoint) {
    return {
      bodyText: JSON.stringify({ error: 'source_unavailable' }),
      error: 'source_unavailable',
      ok: false,
      retryable: true,
      status: 503,
      timing: { queueMs: 0, totalMs: Date.now() - started, upstreamMs: 0 },
    };
  }
  const token = await loadCredential(bindings, input.doc);
  const upstreamStarted = Date.now();
  let response: Response;
  try {
    response = await retryOnce(
      () =>
        fetch(endpoint, {
          body: JSON.stringify(
            buildRemoteMcpCallToolRequest({
              arguments: input.runInput,
              name: input.doc.functionSlug,
            })
          ),
          headers: {
            Accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          method: 'POST',
          signal: input.signal,
        }),
      true
    );
  } catch (error) {
    await invalidateRemoteMcpSnapshot(
      asHotKvBinding(bindings.HOT),
      input.doc.packageId
    );
    if (input.signal?.aborted) {
      return {
        bodyText: JSON.stringify({ error: 'cancelled' }),
        error: 'cancelled',
        ok: false,
        status: 499,
        timing: {
          queueMs: 0,
          totalMs: Date.now() - started,
          upstreamMs: Date.now() - upstreamStarted,
        },
      };
    }
    return {
      bodyText: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      error: 'source_unavailable',
      ok: false,
      retryable: true,
      status: 503,
      timing: {
        queueMs: 0,
        totalMs: Date.now() - started,
        upstreamMs: Date.now() - upstreamStarted,
      },
    };
  }
  if (!response.ok) {
    await invalidateRemoteMcpSnapshot(
      asHotKvBinding(bindings.HOT),
      input.doc.packageId
    );
  }
  const bodyText = await response.text();
  await finishExecution(bindings, {
    callerUserId: input.callerUserId,
    doc: input.doc,
    requestBytes: input.requestBytes,
    responseText: bodyText,
    started,
    status: response.status,
    upstreamMs: Date.now() - upstreamStarted,
  });
  return {
    bodyText,
    ok: response.ok,
    retryable: response.status === 429 || response.status === 503,
    status: response.status,
    timing: {
      queueMs: 0,
      totalMs: Date.now() - started,
      upstreamMs: Date.now() - upstreamStarted,
    },
  };
};
