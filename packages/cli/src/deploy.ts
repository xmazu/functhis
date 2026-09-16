import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadAuthenticatedConfig } from './auth-session';
import { buildWorkerBundle } from './build-bundle';
import { hashSourceTree } from './bundle';
import { resolveWebUrl } from './config';
import type { CliConfig } from './config';
import { discoverProject, filesManifest } from './discover';

const authorizedFetch = (
  config: CliConfig,
  url: string,
  init: RequestInit
): Promise<Response> =>
  fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

export const runDeploy = async (options?: {
  projectRoot?: string;
  slug?: string;
  webUrl?: string;
}): Promise<void> => {
  const config = await loadAuthenticatedConfig();

  const projectRoot = options?.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const slug = options?.slug ?? projectRoot.split('/').at(-1) ?? 'package';
  const webUrl = options?.webUrl ?? resolveWebUrl(config);

  const { files, functions } = await discoverProject(projectRoot);
  const bundle = await buildWorkerBundle({ files, functions });
  const sourceHash = await hashSourceTree(files);

  const startResponse = await authorizedFetch(
    config,
    `${webUrl}/api/deploy/start`,
    {
      body: JSON.stringify({
        filesManifest: filesManifest(files),
        slug,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );

  if (!startResponse.ok) {
    const detail = await startResponse.text();
    throw new Error(
      startResponse.status === 401
        ? `${detail}. Token may be expired — run: functhis login`
        : detail
    );
  }

  const start = (await startResponse.json()) as {
    packageId: string;
  };

  const finalizeResponse = await authorizedFetch(
    config,
    `${webUrl}/api/deploy/finalize`,
    {
      body: JSON.stringify({
        bundle: {
          mainModule: bundle.mainModule,
          modules: bundle.modules,
        },
        bundleHash: bundle.bundleHash,
        contracts: functions,
        packageId: start.packageId,
        sourceHash,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );

  if (!finalizeResponse.ok) {
    throw new Error(await finalizeResponse.text());
  }

  const finalized = (await finalizeResponse.json()) as {
    currentVersionId: string;
    packageId: string;
  };

  console.log(
    `Deployed package ${finalized.packageId} version ${finalized.currentVersionId}`
  );
};

export const runDev = async (options?: {
  functionSlug?: string;
  input?: unknown;
  projectRoot?: string;
}): Promise<void> => {
  const projectRoot = options?.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const { files, functions } = await discoverProject(projectRoot);
  const bundle = await buildWorkerBundle({ files, functions });
  const slug = options?.functionSlug ?? functions[0]?.slug;
  if (!slug) {
    throw new Error('No function slug available');
  }

  const moduleCode = bundle.modules[bundle.mainModule];
  if (!moduleCode) {
    throw new Error('Bundle missing main module');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-dev-'));
  const modulePath = path.join(tempDir, 'worker.mjs');
  await writeFile(modulePath, moduleCode, 'utf-8');
  try {
    const mod = (await import(modulePath)) as {
      default: { fetch: (request: Request) => Promise<Response> };
    };
    const response = await mod.default.fetch(
      new Request('http://local/run', {
        body: JSON.stringify({
          functionSlug: slug,
          input: options?.input ?? {},
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    console.log(await response.text());
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};
