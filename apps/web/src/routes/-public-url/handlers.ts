import { resolveCallerUserId } from '@functhis/auth';
import {
  formatFunctionId,
  getPackageBySlugs,
  publicFunctionPath,
} from '@functhis/publish';
import { z } from 'zod';

import { env } from '#/env.server';
import { resolveCatalogAccess } from '#/routes/-public-url/-catalog/access';
import { executeViaMcp } from '#/routes/-public-url/execute-via-mcp';
import { createAuth, getDb } from '#/services';

import { wantsJsonCatalogResponse } from './accept';
import {
  renderFunctionCatalogHtml,
  renderPackageCatalogHtml,
} from './catalog-pages';
import { catalogUnauthorizedResponse } from './catalog-responses';

const postBodySchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const notFound = (): Response => new Response('Not Found', { status: 404 });

const publishAuthOptions = (database: Awaited<ReturnType<typeof getDb>>) => ({
  consoleUrl: env.BETTER_AUTH_URL,
  resolveSessionUserId: async (request: Request) => {
    const auth = await createAuth(database);
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    const userId = session?.user?.id;
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  },
});

export const handlePublicFunctionRequest = async (
  request: Request,
  params: { handle: string; package: string; function: string }
): Promise<Response> => {
  const database = await getDb();
  const catalog = await getPackageBySlugs(
    database,
    params.handle,
    params.package
  );

  if (!catalog) {
    return notFound();
  }

  const fn =
    catalog.functions.find((row) => row.functionSlug === params.function) ??
    null;

  if (!fn) {
    return notFound();
  }

  const auth = await resolveCallerUserId(
    database,
    request,
    publishAuthOptions(database)
  );

  const access = await resolveCatalogAccess(request, catalog, {
    database,
    resolvedUserId: auth.ok ? auth.userId : null,
  });
  if (access.access === 'sign-in') {
    return catalogUnauthorizedResponse(request);
  }
  if (access.access === 'not-found') {
    return notFound();
  }

  const accessContext = access.context;

  const functionId = formatFunctionId({
    functionSlug: fn.functionSlug,
    handle: fn.handle,
    packageSlug: fn.packageSlug,
  });

  if (request.method === 'GET') {
    const payload = {
      contract: fn.contract,
      exportName: fn.exportName,
      id: functionId,
      path: fn.path,
      visibility: catalog.visibility,
    };

    if (wantsJsonCatalogResponse(request)) {
      return Response.json(payload);
    }

    return new Response(renderFunctionCatalogHtml(fn, catalog, functionId), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'POST') {
    if (!auth.ok) {
      return catalogUnauthorizedResponse(request);
    }

    let body: unknown = {};
    try {
      const text = await request.text();
      body = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }

    const upstream = await executeViaMcp({
      arguments: parsed.data.arguments,
      callerUserId: accessContext.userId,
      id: functionId,
    });
    const responseText = await upstream.text();
    return new Response(responseText, {
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/json',
      },
      status: upstream.status,
    });
  }

  return new Response('Method Not Allowed', {
    headers: { Allow: 'GET, POST' },
    status: 405,
  });
};

export const handlePublicPackageRequest = async (
  request: Request,
  params: { handle: string; package: string }
): Promise<Response> => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      headers: { Allow: 'GET' },
      status: 405,
    });
  }

  const database = await getDb();
  const catalog = await getPackageBySlugs(
    database,
    params.handle,
    params.package
  );

  if (!catalog) {
    return notFound();
  }

  const access = await resolveCatalogAccess(request, catalog);
  if (access.access === 'sign-in') {
    return catalogUnauthorizedResponse(request);
  }
  if (access.access === 'not-found') {
    return notFound();
  }

  const payload = {
    currentVersion: {
      publishedAt: catalog.currentVersion.publishedAt.toISOString(),
      semver: catalog.currentVersion.semver,
    },
    functions: catalog.functions.map((fn) => ({
      contract: fn.contract,
      id: formatFunctionId({
        functionSlug: fn.functionSlug,
        handle: fn.handle,
        packageSlug: fn.packageSlug,
      }),
      slug: fn.functionSlug,
      url: publicFunctionPath(fn),
    })),
    handle: catalog.handle,
    packageSlug: catalog.packageSlug,
    visibility: catalog.visibility,
  };

  if (wantsJsonCatalogResponse(request)) {
    return Response.json(payload);
  }

  return new Response(renderPackageCatalogHtml(catalog), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
