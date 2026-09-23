import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { PublishArtifact } from '@functhis/publish/artifact';
import { WORKER_COMPATIBILITY_DATE } from '@functhis/publish/constants';

import type { WorkerLoaderBundle } from './build-bundle';
import type { DiscoveredFunction } from './discover';

export interface PublishManifestFunction {
  description: string;
  examples?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  path: string;
  slug: string;
  sourceHash: string;
}

export interface PublishManifest {
  functions: PublishManifestFunction[];
  package: string;
  runtimeVersion: string;
  scope?: string;
  secrets: string[];
}

export interface PublishBuildInfo {
  builtAt: string;
  bundler: { name: 'esbuild'; version: string };
  cliVersion: string;
  gitCommit?: string;
  gitDirty: boolean;
  lockfileHash?: string;
  runtimeVersion: string;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const hashFunctionSource = (content: string): string => sha256(content);

export const readLockfileHash = async (
  packageRoot: string
): Promise<string | undefined> => {
  const names = ['bun.lock', 'package-lock.json', 'pnpm-lock.yaml'] as const;
  const hashes = await Promise.all(
    names.map(async (name) => {
      try {
        const content = await readFile(path.join(packageRoot, name), 'utf-8');
        return sha256(content);
      } catch {
        // Missing lockfile.
      }
    })
  );
  return hashes.find((hash) => hash !== undefined);
};

export const buildPublishArtifact = (input: {
  bundle: WorkerLoaderBundle;
  build: PublishBuildInfo;
  files: Record<string, string>;
  functions: DiscoveredFunction[];
  packageSlug: string;
  scope?: string;
}): { artifact: PublishArtifact; manifest: PublishManifest } => {
  const manifest: PublishManifest = {
    functions: input.functions.map((fn) => ({
      description: fn.contract.description,
      examples: fn.contract.examples,
      inputSchema: fn.contract.inputSchema,
      outputSchema: fn.contract.outputSchema,
      path: fn.path,
      slug: fn.slug,
      sourceHash: hashFunctionSource(input.files[fn.path] ?? ''),
    })),
    package: input.packageSlug,
    runtimeVersion: WORKER_COMPATIBILITY_DATE,
    scope: input.scope,
    secrets: [],
  };

  return {
    artifact: {
      buildJson: JSON.stringify(input.build),
      bundle: input.bundle.modules[input.bundle.mainModule] ?? '',
      manifestJson: JSON.stringify(manifest),
      sourceMap: input.bundle.sourceMap,
    },
    manifest,
  };
};
