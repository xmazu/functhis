import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { buildFunctionContract } from './discover-contract';
import type { FunctionContract } from './discover-contract';
import { loadPackageIdentity } from './package-config';
import type { PackageIdentity } from './package-config';

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

const kebabSegment = (value: string): string =>
  value
    .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>-$<upper>')
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/[^a-z0-9-]+/gu, '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

/** Function slug from a function-root-relative `.ts` / `.tsx` path. */
export const slugFromRelativePath = (filePath: string): string => {
  const base = filePath.replace(/\.tsx?$/u, '');
  const segments = base.split('/').filter(Boolean);
  const last = segments.at(-1);
  const usable = last === 'index' ? segments.slice(0, -1) : segments;
  return usable.map(kebabSegment).filter(Boolean).join('/');
};

const isSourceFile = (name: string): boolean => /\.tsx?$/u.test(name);

const isIgnoredSourceFile = (name: string): boolean =>
  /\.test\.tsx?$/u.test(name) ||
  /\.spec\.tsx?$/u.test(name) ||
  name.endsWith('.d.ts');

const walkDeep = async (
  packageRoot: string,
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
      return walkDeep(packageRoot, absolute);
    }
    if (
      !entry.isFile() ||
      !isSourceFile(entry.name) ||
      isIgnoredSourceFile(entry.name)
    ) {
      return [];
    }
    return [path.relative(packageRoot, absolute)];
  };

  const nested = await Promise.all(entries.map(mapEntry));
  return nested.flat();
};

const listShallowSources = async (packageRoot: string): Promise<string[]> => {
  const entries = await readdir(packageRoot, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        isSourceFile(entry.name) &&
        !isIgnoredSourceFile(entry.name)
    )
    .map((entry) => entry.name);
};

const directoryExists = async (directory: string): Promise<boolean> => {
  try {
    const info = await stat(directory);
    return info.isDirectory();
  } catch {
    return false;
  }
};

export const resolveFunctionRoot = async (
  packageRoot: string,
  configuredRoot?: string
): Promise<{ recursive: boolean; root: string }> => {
  if (configuredRoot) {
    return {
      recursive: true,
      root: path.resolve(packageRoot, configuredRoot),
    };
  }

  const srcRoot = path.join(packageRoot, 'src');
  if (await directoryExists(srcRoot)) {
    return { recursive: true, root: srcRoot };
  }

  const functionsRoot = path.join(packageRoot, 'functions');
  if (await directoryExists(functionsRoot)) {
    return { recursive: true, root: functionsRoot };
  }

  return { recursive: false, root: packageRoot };
};

const resolveSourcePaths = async (
  packageRoot: string,
  functionRoot: { recursive: boolean; root: string }
): Promise<string[]> => {
  if (!functionRoot.recursive) {
    return listShallowSources(packageRoot);
  }
  if (!(await directoryExists(functionRoot.root))) {
    return [];
  }
  return walkDeep(packageRoot, functionRoot.root);
};

export const discoverProject = async (
  projectRoot: string,
  identity?: PackageIdentity | null
): Promise<{
  files: Record<string, string>;
  functionRoot: string;
  functions: DiscoveredFunction[];
  identity: PackageIdentity | null;
  packageRoot: string;
}> => {
  const absoluteStart = path.resolve(projectRoot);
  const resolvedIdentity =
    identity === undefined
      ? await loadPackageIdentity(absoluteStart)
      : identity;
  const packageRoot = resolvedIdentity?.packageRoot ?? absoluteStart;
  const functionRoot = await resolveFunctionRoot(
    packageRoot,
    resolvedIdentity?.functhis.root
  );
  const sourcePaths = await resolveSourcePaths(packageRoot, functionRoot);
  const discoveredPaths = sourcePaths.toSorted();
  const fileEntries = await Promise.all(
    discoveredPaths.map(async (relativePath) => {
      const absolute = path.join(packageRoot, relativePath);
      const content = await readFile(absolute, 'utf-8');
      return { content, relativePath };
    })
  );
  const files: Record<string, string> = {};
  const functions: DiscoveredFunction[] = [];

  for (const { content, relativePath } of fileEntries) {
    files[relativePath] = content;
    const fromFunctionRoot = path
      .relative(functionRoot.root, path.join(packageRoot, relativePath))
      .split(path.sep)
      .join('/');
    const slug = slugFromRelativePath(fromFunctionRoot);
    if (!slug) {
      continue;
    }
    const contract = buildFunctionContract({
      content,
      projectRoot: packageRoot,
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
    if (resolvedIdentity?.isWorkspaceRoot) {
      throw new Error(
        `No functions found in ${packageRoot}. cd into a package.`
      );
    }
    throw new Error(
      `No functions found in ${packageRoot}. Add a default-export .ts file under src/, functions/, or set "functhis.root" in package.json.`
    );
  }

  return {
    files,
    functionRoot: functionRoot.root,
    functions,
    identity: resolvedIdentity,
    packageRoot,
  };
};

export const filesManifest = (
  fileMap: Record<string, string>
): { bytes: number; path: string }[] =>
  Object.entries(fileMap).map(([filePath, content]) => ({
    bytes: new TextEncoder().encode(content).byteLength,
    path: filePath,
  }));
