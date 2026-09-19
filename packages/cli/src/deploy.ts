import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  deployFinalizeResponseSchema,
  isValidPackageSlug,
} from '@functhis/deploy';

import { loadAuthenticatedConfig } from './auth-session';
import { buildWorkerBundle } from './build-bundle';
import { hashSourceTree } from './bundle';
import { resolveWebUrl } from './config';
import type { CliConfig } from './config';
import { formatDeployResult } from './deploy-output';
import { discoverProject, filesManifest } from './discover';
import { formatRunResponseBody } from './run-output';

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

const INVALID_PACKAGE_SLUG_MESSAGE =
  'Invalid package slug. Use lowercase letters, numbers, and hyphens (e.g. hello-world).';

export const resolvePackageSlug = (
  projectRoot: string,
  explicit?: string
): string => {
  if (explicit !== undefined) {
    if (!isValidPackageSlug(explicit)) {
      throw new Error(INVALID_PACKAGE_SLUG_MESSAGE);
    }
    return explicit;
  }
  const base = projectRoot.split('/').at(-1) ?? 'package';
  return isValidPackageSlug(base) ? base : 'package';
};

export const runDeploy = async (options?: {
  organizationSlug?: string;
  projectRoot?: string;
  slug?: string;
  visibility?: 'library' | 'organization' | 'private';
  webUrl?: string;
}): Promise<void> => {
  const config = await loadAuthenticatedConfig();

  const projectRoot = options?.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const slug = resolvePackageSlug(projectRoot, options?.slug);
  const webUrl = resolveWebUrl(config, options?.webUrl);

  const { files, functions } = await discoverProject(projectRoot);
  const bundle = await buildWorkerBundle({ files, functions });
  const sourceHash = await hashSourceTree(files);

  const startBody: Record<string, unknown> = {
    filesManifest: filesManifest(files),
    slug,
  };
  if (options?.visibility !== undefined) {
    startBody.visibility = options.visibility;
  }
  if (options?.organizationSlug !== undefined) {
    startBody.organizationSlug = options.organizationSlug;
  }

  const startResponse = await authorizedFetch(
    config,
    `${webUrl}/api/deploy/start`,
    {
      body: JSON.stringify(startBody),
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

  const finalizedJson = await finalizeResponse.json();
  const parsed = deployFinalizeResponseSchema.safeParse(finalizedJson);
  if (!parsed.success) {
    throw new Error('Deploy finalize returned an unexpected response');
  }

  for (const line of formatDeployResult(webUrl, parsed.data)) {
    console.log(line);
  }
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
    const bodyText = await response.text();
    console.log(formatRunResponseBody(response, bodyText));
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};
