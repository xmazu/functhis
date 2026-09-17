import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { buildFunctionContract } from './discover-contract';
import type { FunctionContract } from './discover-contract';

const FUNCTIONS_DIR = 'functions';

const ignoredDirectories = new Set([
  'dist',
  'node_modules',
  '.git',
  '.functhis',
]);

export interface DiscoveredFunction {
  contract: FunctionContract;
  exportName: string;
  path: string;
  slug: string;
}

const slugFromPath = (filePath: string): string => {
  const base = filePath.replace(/\.tsx?$/u, '');
  const segments = base.split('/');
  const last = segments.at(-1) ?? base;
  return last
    .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>-$<upper>')
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/[^a-z0-9-]+/gu, '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
};

const isSourceFile = (name: string): boolean => /\.tsx?$/u.test(name);

const walkDeep = async (
  projectRoot: string,
  directory: string
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const mapEntry = (
    entry: (typeof entries)[number]
  ): string[] | Promise<string[]> => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkDeep(projectRoot, absolute);
    }
    if (!entry.isFile() || !isSourceFile(entry.name)) {
      return [];
    }
    return [path.relative(projectRoot, absolute)];
  };

  const nested = await Promise.all(entries.map(mapEntry));
  return nested.flat();
};

const listShallowSources = async (projectRoot: string): Promise<string[]> => {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isSourceFile(entry.name))
    .map((entry) => entry.name);
};

const resolveSourcePaths = async (projectRoot: string): Promise<string[]> => {
  const functionsDir = path.join(projectRoot, FUNCTIONS_DIR);
  try {
    const functionsStat = await stat(functionsDir);
    if (functionsStat.isDirectory()) {
      return walkDeep(projectRoot, functionsDir);
    }
  } catch {
    // No functions/ directory — use project root entry files only.
  }
  return listShallowSources(projectRoot);
};

export const discoverProject = async (
  projectRoot: string
): Promise<{
  files: Record<string, string>;
  functions: DiscoveredFunction[];
}> => {
  const absoluteRoot = path.resolve(projectRoot);
  const sourcePaths = await resolveSourcePaths(absoluteRoot);
  const discoveredPaths = sourcePaths.toSorted();
  const fileEntries = await Promise.all(
    discoveredPaths.map(async (relativePath) => {
      const absolute = path.join(absoluteRoot, relativePath);
      const content = await readFile(absolute, 'utf-8');
      return { content, relativePath };
    })
  );

  const files: Record<string, string> = {};
  const functions: DiscoveredFunction[] = [];

  for (const { content, relativePath } of fileEntries) {
    files[relativePath] = content;
    const slug = slugFromPath(relativePath);
    if (!slug) {
      continue;
    }
    const contract = buildFunctionContract({
      content,
      projectRoot: absoluteRoot,
      relativePath,
      slug,
    });
    if (!contract) {
      continue;
    }
    functions.push({
      contract,
      exportName: 'default',
      path: relativePath,
      slug,
    });
  }

  if (functions.length === 0) {
    throw new Error(
      'No functions found. Add a .ts file with a default export at the project root, or under functions/.'
    );
  }

  return { files, functions };
};

export const filesManifest = (
  fileMap: Record<string, string>
): { bytes: number; path: string }[] =>
  Object.entries(fileMap).map(([filePath, content]) => ({
    bytes: new TextEncoder().encode(content).byteLength,
    path: filePath,
  }));
