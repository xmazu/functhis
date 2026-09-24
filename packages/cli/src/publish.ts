import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { hashPublishArtifact } from '@functhis/publish/artifact';
import { WORKER_COMPATIBILITY_DATE } from '@functhis/publish/constants';
import {
  publishFinalizeResponseSchema,
  publishRollbackResponseSchema,
  isValidPackageSlug,
} from '@functhis/publish/schemas';
import type { VersionBump } from '@functhis/publish/semver';
import { validateContractInput } from '@functhis/publish/validate-input';
import { createRuntimeModuleSource } from '@functhis/runtime';

import { loadAuthenticatedConfig } from './auth-session';
import { buildWorkerBundle } from './build-bundle';
import { hashSourceTree } from './bundle';
import { resolveWebUrl } from './config';
import type { CliConfig } from './config';
import { discoverProject, filesManifest } from './discover';
import { readGitMetadata } from './git-metadata';
import {
  loadPackageIdentity,
  packageSlugFromNpmName,
  writeFuncthisPackageFields,
} from './package-config';
import type { PackageIdentity } from './package-config';
import { buildPublishArtifact, readLockfileHash } from './publish-artifact';
import { formatPublishResult } from './publish-output';
import { formatRunResponseBody } from './run-output';

const require = createRequire(import.meta.url);

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

const readCliVersion = (): string => {
  try {
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const readEsbuildVersion = (): string => {
  try {
    const pkg = require('esbuild/package.json') as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

export const resolvePackageSlug = (
  projectRoot: string,
  explicit?: string,
  identity?: PackageIdentity | null
): string => {
  if (explicit !== undefined) {
    if (!isValidPackageSlug(explicit)) {
      throw new Error(INVALID_PACKAGE_SLUG_MESSAGE);
    }
    return explicit;
  }
  const configured = identity?.functhis.name;
  if (configured) {
    if (!isValidPackageSlug(configured)) {
      throw new Error(INVALID_PACKAGE_SLUG_MESSAGE);
    }
    return configured;
  }
  if (identity?.name) {
    const fromNpm = packageSlugFromNpmName(identity.name);
    if (isValidPackageSlug(fromNpm)) {
      return fromNpm;
    }
  }
  const base = projectRoot.split('/').at(-1) ?? 'package';
  return isValidPackageSlug(base) ? base : 'package';
};

export interface PublishOptions {
  bump?: VersionBump;
  organizationSlug?: string;
  projectRoot?: string;
  scope?: string;
  slug?: string;
  visibility?: 'library' | 'organization' | 'private';
  webUrl?: string;
}

const throwUnlessOk = async (
  response: Response,
  fallback: string
): Promise<void> => {
  if (response.ok) {
    return;
  }
  const detail = await response.text();
  if (response.status === 401) {
    throw new Error(`${detail}. Token may be expired - run: functhis login`);
  }
  throw new Error(detail || fallback);
};

const resolvePublishIdentity = async (
  options?: PublishOptions
): Promise<{
  identity: PackageIdentity | null;
  packageRoot: string;
  scope?: string;
  slug: string;
}> => {
  const startDir = options?.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const identity = await loadPackageIdentity(startDir);
  const packageRoot = identity?.packageRoot ?? startDir;
  const slug = resolvePackageSlug(packageRoot, options?.slug, identity);
  const scope =
    options?.scope ?? options?.organizationSlug ?? identity?.functhis.scope;

  if (identity?.functhis.scope && scope && identity.functhis.scope !== scope) {
    throw new Error(
      `Cannot change package scope from ${identity.functhis.scope} to ${scope}.`
    );
  }

  return { identity, packageRoot, scope, slug };
};

export const runPublish = async (options?: PublishOptions): Promise<void> => {
  const config = await loadAuthenticatedConfig();
  const { identity, packageRoot, scope, slug } =
    await resolvePublishIdentity(options);
  const webUrl = resolveWebUrl(config, options?.webUrl);
  const { files, functions, functionRoot } = await discoverProject(
    packageRoot,
    identity
  );
  const bundle = await buildWorkerBundle({ files, functions, packageRoot });
  const sourceHash = await hashSourceTree(files);
  const git = readGitMetadata(packageRoot);
  if (git.gitDirty) {
    console.warn(
      'Warning: git working tree is dirty. The commit hash is recorded as provenance only.'
    );
  }

  const { artifact } = buildPublishArtifact({
    build: {
      builtAt: new Date().toISOString(),
      bundler: { name: 'esbuild', version: readEsbuildVersion() },
      cliVersion: readCliVersion(),
      gitCommit: git.gitCommit,
      gitDirty: git.gitDirty,
      lockfileHash: await readLockfileHash(packageRoot),
      runtimeVersion: WORKER_COMPATIBILITY_DATE,
    },
    bundle,
    files,
    functions,
    packageSlug: slug,
    scope,
  });
  const contentHash = await hashPublishArtifact(artifact);

  const startBody: Record<string, unknown> = {
    filesManifest: filesManifest(files),
    slug,
  };
  if (options?.visibility !== undefined) {
    startBody.visibility = options.visibility;
  }
  if (scope !== undefined) {
    startBody.scope = scope;
  }

  const startResponse = await authorizedFetch(
    config,
    `${webUrl}/api/publish/start`,
    {
      body: JSON.stringify(startBody),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );
  await throwUnlessOk(startResponse, 'Publish start failed');
  const start = (await startResponse.json()) as { packageId: string };

  const finalizeResponse = await authorizedFetch(
    config,
    `${webUrl}/api/publish/finalize`,
    {
      body: JSON.stringify({
        artifact,
        bump: options?.bump,
        bundle: {
          mainModule: bundle.mainModule,
          modules: bundle.modules,
        },
        bundleHash: bundle.bundleHash,
        contentHash,
        contracts: functions,
        gitDirty: git.gitDirty,
        gitSha: git.gitCommit,
        packageId: start.packageId,
        sourceHash,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );
  await throwUnlessOk(finalizeResponse, 'Publish finalize failed');

  const parsed = publishFinalizeResponseSchema.safeParse(
    await finalizeResponse.json()
  );
  if (!parsed.success) {
    throw new Error('Publish finalize returned an unexpected response');
  }

  if (identity?.packageJsonPath) {
    const relativeRoot = path
      .relative(packageRoot, functionRoot)
      .split(path.sep)
      .join('/');
    await writeFuncthisPackageFields(identity.packageJsonPath, {
      name: identity.functhis.name ?? slug,
      root: identity.functhis.root ?? (relativeRoot || undefined),
      scope: identity.functhis.scope ?? parsed.data.handle,
    });
  }

  for (const line of formatPublishResult(webUrl, parsed.data)) {
    console.log(line);
  }
};

export const runRollback = async (options: {
  projectRoot?: string;
  scope?: string;
  semver: string;
  slug?: string;
  webUrl?: string;
}): Promise<void> => {
  const config = await loadAuthenticatedConfig();
  const startDir = options.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const identity = await loadPackageIdentity(startDir);
  const packageRoot = identity?.packageRoot ?? startDir;
  const slug = resolvePackageSlug(packageRoot, options.slug, identity);
  const scope = options.scope ?? identity?.functhis.scope;
  const webUrl = resolveWebUrl(config, options.webUrl);

  const response = await authorizedFetch(
    config,
    `${webUrl}/api/publish/rollback`,
    {
      body: JSON.stringify({
        scope,
        semver: options.semver,
        slug,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const parsed = publishRollbackResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Rollback returned an unexpected response');
  }

  console.log(
    `Rolled back @${parsed.data.handle}/${parsed.data.slug} to ${parsed.data.semver}`
  );
};

export const runDev = async (options?: {
  functionSlug?: string;
  input?: unknown;
  projectRoot?: string;
  secrets?: Record<string, string>;
}): Promise<void> => {
  const projectRoot = options?.projectRoot
    ? path.resolve(process.cwd(), options.projectRoot)
    : process.cwd();
  const { files, functions } = await discoverProject(projectRoot);
  const bundle = await buildWorkerBundle({
    files,
    functions,
    packageRoot: projectRoot,
  });
  const slug = options?.functionSlug ?? functions[0]?.slug;
  if (!slug) {
    throw new Error('No function slug available');
  }

  const target = functions.find((fn) => fn.slug === slug);
  if (!target) {
    throw new Error(`Unknown function slug: ${slug}`);
  }
  const runInput = options?.input ?? {};
  const validation = validateContractInput(
    target.contract.inputSchema,
    runInput
  );
  if (!validation.ok) {
    throw new Error(
      `invalid_input: ${JSON.stringify({ issues: validation.issues })}`
    );
  }

  const moduleCode = bundle.modules[bundle.mainModule];
  if (!moduleCode) {
    throw new Error('Bundle missing main module');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'functhis-dev-'));
  const modulePath = path.join(tempDir, 'worker.mjs');
  const runtimePath = path.join(tempDir, '__functhis_runtime.mjs');
  await writeFile(modulePath, moduleCode, 'utf-8');
  await writeFile(runtimePath, createRuntimeModuleSource(), 'utf-8');
  try {
    const mod = (await import(modulePath)) as {
      default: { fetch: (request: Request) => Promise<Response> };
    };
    const response = await mod.default.fetch(
      new Request('http://local/run', {
        body: JSON.stringify({
          functionSlug: slug,
          input: runInput,
          runtime: {
            context: {
              callerUserId: null,
              executionId: randomUUID(),
              functionSlug: slug,
              packageVersionId: 'local',
            },
            secrets: options?.secrets ?? {},
          },
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
