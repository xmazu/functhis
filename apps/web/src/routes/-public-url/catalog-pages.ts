import {
  publicFunctionPath,
  publicPackagePath,
  safeCallbackURLFromRequest,
} from '@functhis/publish';
import type { CatalogFunctionRow, CatalogPackageRow } from '@functhis/publish';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const renderCatalogSignInHtml = (requestUrl: string): string => {
  const callbackPath = safeCallbackURLFromRequest(requestUrl);
  const loginUrl = new URL('/login', new URL(requestUrl).origin);
  loginUrl.searchParams.set('callbackURL', callbackPath);

  return `<!doctype html>
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
  <p>Sign in with an account that owns this package or belongs to its organization, then open this URL again.</p>
  <p><a href="${escapeHtml(loginUrl.href)}">Sign in</a></p>
</body>
</html>`;
};

export const catalogSignInHtmlResponse = (requestUrl: string): Response =>
  new Response(renderCatalogSignInHtml(requestUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 401,
  });

export const renderPackageCatalogHtml = (
  catalog: CatalogPackageRow
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

export const renderFunctionCatalogHtml = (
  fn: CatalogFunctionRow,
  catalog: CatalogPackageRow,
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
  <p>POST uses your signed-in session on this site.</p>
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
