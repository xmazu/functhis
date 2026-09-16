import { createDb } from '@functhis/db';
import { execution, packageVersion } from '@functhis/db/schema/catalog';
import {
  bundleKvKey,
  isRuntimeExecuteAuthorized,
  runtimeExecuteBodySchema,
  WORKER_COMPATIBILITY_DATE,
} from '@functhis/deploy';
import { and, eq } from 'drizzle-orm';

const CPU_MS = 30_000;
const SUB_REQUESTS = 50;

interface StoredBundle {
  mainModule: string;
  modules: Record<string, string>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/execute' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    if (!isRuntimeExecuteAuthorized(request, env.RUNTIME_EXECUTE_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = runtimeExecuteBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }

    if (env.HYPERDRIVE) {
      try {
        const database = await createDb(env);
        const [versionRow] = await database
          .select({ id: packageVersion.id })
          .from(packageVersion)
          .where(
            and(
              eq(packageVersion.id, parsed.data.versionId),
              eq(packageVersion.bundleHash, parsed.data.bundleHash)
            )
          )
          .limit(1);

        if (!versionRow) {
          return Response.json(
            { error: 'versionId does not match bundleHash' },
            { status: 404 }
          );
        }
      } catch {
        return Response.json(
          { error: 'Failed to validate package version' },
          { status: 503 }
        );
      }
    }

    const kvKey = bundleKvKey(parsed.data.bundleHash);
    const stored = await env.BUNDLES.get(kvKey);
    if (!stored) {
      return Response.json(
        { error: 'Bundle not found in KV' },
        { status: 404 }
      );
    }

    let bundle: StoredBundle;
    try {
      bundle = JSON.parse(stored) as StoredBundle;
    } catch {
      return Response.json(
        { error: 'Invalid bundle payload in KV' },
        { status: 500 }
      );
    }

    const limits = { cpuMs: CPU_MS, subRequests: SUB_REQUESTS };

    const worker = env.LOADER.get(parsed.data.versionId, () => ({
      compatibilityDate: WORKER_COMPATIBILITY_DATE,
      env: {},
      globalOutbound: null,
      limits,
      mainModule: bundle.mainModule,
      modules: bundle.modules,
    }));

    const entrypoint = worker.getEntrypoint(undefined, { limits });
    const runRequest = new Request('https://worker.internal/run', {
      body: JSON.stringify({
        functionSlug: parsed.data.functionSlug,
        input: parsed.data.input ?? {},
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    const startedAt = Date.now();
    let status = 'ok';
    let responseText = '';

    try {
      const workerResponse = await entrypoint.fetch(runRequest);
      responseText = await workerResponse.text();
      if (!workerResponse.ok) {
        status = 'error';
      }
    } catch (error) {
      status = 'error';
      responseText = JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const durationMs = Date.now() - startedAt;

    if (parsed.data.callerUserId && env.HYPERDRIVE) {
      try {
        const database = await createDb(env);
        await database.insert(execution).values({
          callerUserId: parsed.data.callerUserId,
          cpuMs: durationMs,
          packageVersionId: parsed.data.versionId,
          status,
        });
      } catch {
        // Execution row is best-effort when DB is unavailable in local dev.
      }
    }

    return new Response(responseText, {
      headers: { 'content-type': 'application/json' },
      status: status === 'ok' ? 200 : 500,
    });
  },
};
