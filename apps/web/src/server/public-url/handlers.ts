import { resolveCallerUserId } from '@functhis/auth';
import {
  buildPackageAccessContext,
  canViewCatalogPage,
  canViewCatalogWithoutAuth,
  formatFunctionId,
  getPackageBySlugs,
  publicFunctionPath,
  publicPackagePath,
  safeCallbackURLFromRequest,
} from '@functhis/deploy';
import type {
  getFunctionBySlugs,
  PackageAccessContext,
} from '@functhis/deploy';
import { z } from 'zod';

import { env } from '../../env.server';
import { getDb } from '../../services';
import { executeViaMcp } from '../execute-via-mcp';

const postBodySchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const wantsJsonContract = (request: Request): boolean => {
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('application/json');
};

const resolveViewerAccessContext = async (
  request: Request
): Promise<PackageAccessContext> => {
  const database = await getDb();
  const auth = await resolveCallerUserId(database, request, {
    consoleUrl: env.CONSOLE_URL,
  });
  return buildPackageAccessContext(database, auth.ok ? auth.userId : null);
};

const relaxCatalogPageInDevelopment = (): boolean =>
  env.NODE_ENV === 'development';

const catalogPageAccess = (
  catalog: Awaited<ReturnType<typeof getPackageBySlugs>> & object,
  accessContext: PackageAccessContext
): 'allow' | 'sign-in' => {
  if (
    canViewCatalogPage(catalog, accessContext, {
      relaxInDevelopment: relaxCatalogPageInDevelopment(),
    })
  ) {
    return 'allow';
  }
  return 'sign-in';
};

const notFound = (): Response => new Response('Not Found', { status: 404 });

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const signInRequired = (request: Request): Response => {
  const callbackPath = safeCallbackURLFromRequest(request.url);
  const loginUrl = new URL('/login', env.CONSOLE_URL);
  loginUrl.searchParams.set('callbackURL', callbackPath);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in required · Functhis</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 36rem; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Sign in required</h1>
  <p>This package is not public. Sign in on the console with an account that owns it or belongs to its organization, then open this URL again.</p>
  <p>On <code>localhost</code>, console login on port 3002 does not share cookies with web on 3001 - use local dev (pages are open in development) or call POST with your CLI bearer token.</p>
  <p><a href="${escapeHtml(loginUrl.href)}">Sign in on console</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 401,
  });
};

const renderPackagePageHtml = (
  catalog: Awaited<ReturnType<typeof getPackageBySlugs>> & object
): string => {
  const title = `@${catalog.handle}/${catalog.packageSlug}`;
  const items = catalog.functions
    .map((fn) => {
      const href = escapeHtml(publicFunctionPath(fn));
      const label = escapeHtml(fn.functionSlug);
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Functhis</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
    h1 { font-size: 1.25rem; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Functions in this package.</p>
  <ul>${items}</ul>
</body>
</html>`;
};

const defaultArgumentsJson = (contract: unknown): string => {
  if (
    contract &&
    typeof contract === 'object' &&
    'inputSchema' in contract &&
    contract.inputSchema &&
    typeof contract.inputSchema === 'object'
  ) {
    return JSON.stringify({}, null, 2);
  }
  return '{}';
};

const renderFunctionPageHtml = (
  fn: Awaited<ReturnType<typeof getFunctionBySlugs>> & object,
  catalog: Awaited<ReturnType<typeof getPackageBySlugs>> & object,
  functionId: string
): string => {
  const title = functionId;
  const description =
    fn.contract &&
    typeof fn.contract === 'object' &&
    'description' in fn.contract &&
    typeof fn.contract.description === 'string'
      ? fn.contract.description
      : 'Run this function with JSON arguments.';

  const argsDefault = escapeHtml(defaultArgumentsJson(fn.contract));
  const packagePath = escapeHtml(publicPackagePath(catalog));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Functhis</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 48rem; line-height: 1.5; }
    textarea { width: 100%; min-height: 10rem; font-family: ui-monospace, monospace; }
    pre { background: #111; color: #eee; padding: 1rem; overflow: auto; }
    button { margin-top: 0.75rem; padding: 0.5rem 1rem; }
  </style>
</head>
<body>
  <p><a href="${packagePath}">← @${escapeHtml(catalog.handle)}/${escapeHtml(catalog.packageSlug)}</a></p>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <h2>Contract</h2>
  <pre>${escapeHtml(JSON.stringify(fn.contract, null, 2))}</pre>
  <h2>Try it</h2>
  <p>Sign in on ${escapeHtml(env.CONSOLE_URL)} so your session cookie can authorize POST.</p>
  <form id="try-it">
    <label for="arguments">Arguments (JSON)</label>
    <textarea id="arguments" name="arguments">${argsDefault}</textarea>
    <button type="submit">Run</button>
  </form>
  <h2>Response</h2>
  <pre id="output">(no run yet)</pre>
  <script>
    const form = document.getElementById('try-it');
    const output = document.getElementById('output');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      output.textContent = 'Running…';
      let parsed;
      try {
        parsed = JSON.parse(document.getElementById('arguments').value);
      } catch {
        output.textContent = 'Invalid JSON in arguments';
        return;
      }
      const response = await fetch(location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: parsed }),
        credentials: 'include',
      });
      output.textContent = await response.text();
    });
  </script>
</body>
</html>`;
};

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

  const authOptions = { consoleUrl: env.CONSOLE_URL };
  const auth = await resolveCallerUserId(database, request, authOptions);
  const accessContext = await buildPackageAccessContext(
    database,
    auth.ok ? auth.userId : null
  );

  if (request.method === 'POST' && !auth.ok) {
    const allowsAnonymousPost = canViewCatalogWithoutAuth(catalog, {
      relaxInDevelopment: relaxCatalogPageInDevelopment(),
    });
    if (!allowsAnonymousPost) {
      return auth.response;
    }
  }

  const access = catalogPageAccess(catalog, accessContext);
  if (access === 'sign-in') {
    return request.method === 'GET'
      ? signInRequired(request)
      : new Response('Unauthorized', { status: 401 });
  }

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

    if (wantsJsonContract(request)) {
      return Response.json(payload);
    }

    return new Response(renderFunctionPageHtml(fn, catalog, functionId), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'POST') {
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

  const viewerAccessContext = await resolveViewerAccessContext(request);
  if (catalogPageAccess(catalog, viewerAccessContext) === 'sign-in') {
    return signInRequired(request);
  }

  const payload = {
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

  if (wantsJsonContract(request)) {
    return Response.json(payload);
  }

  return new Response(renderPackagePageHtml(catalog), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
