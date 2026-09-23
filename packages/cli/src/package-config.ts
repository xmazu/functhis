import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface FuncthisPackageFields {
  name?: string;
  root?: string;
  scope?: string;
}

export interface PackageIdentity {
  functhis: FuncthisPackageFields;
  isWorkspaceRoot: boolean;
  name?: string;
  packageJsonPath: string;
  packageRoot: string;
}

const PACKAGE_JSON = 'package.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readFuncthisFields = (raw: unknown): FuncthisPackageFields => {
  if (!isRecord(raw)) {
    return {};
  }
  const name = typeof raw.name === 'string' ? raw.name : undefined;
  const root = typeof raw.root === 'string' ? raw.root : undefined;
  const scope = typeof raw.scope === 'string' ? raw.scope : undefined;
  return { name, root, scope };
};

const unscopedNpmName = (name: string): string => {
  const match = /^@[^/]+\/(?<pkg>.+)$/u.exec(name);
  return match?.groups?.pkg ?? name;
};

export const packageSlugFromNpmName = (name: string): string =>
  unscopedNpmName(name)
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

export const findNearestPackageJson = async (
  startDir: string
): Promise<string | null> => {
  const current = path.resolve(startDir);
  const candidate = path.join(current, PACKAGE_JSON);
  try {
    await access(candidate);
    return candidate;
  } catch {
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    return findNearestPackageJson(parent);
  }
};

export const loadPackageIdentity = async (
  startDir: string
): Promise<PackageIdentity | null> => {
  const packageJsonPath = await findNearestPackageJson(startDir);
  if (!packageJsonPath) {
    return null;
  }

  const raw = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as unknown;
  if (!isRecord(raw)) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name : undefined;
  return {
    functhis: readFuncthisFields(raw.functhis),
    isWorkspaceRoot: Array.isArray(raw.workspaces) || isRecord(raw.workspaces),
    name,
    packageJsonPath,
    packageRoot: path.dirname(packageJsonPath),
  };
};

export const writeFuncthisPackageFields = async (
  packageJsonPath: string,
  fields: FuncthisPackageFields
): Promise<void> => {
  const raw = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as unknown;
  if (!isRecord(raw)) {
    throw new Error('package.json is not an object');
  }

  const current = readFuncthisFields(raw.functhis);
  raw.functhis = {
    ...current,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    ),
  };

  await writeFile(
    packageJsonPath,
    `${JSON.stringify(raw, null, 2)}\n`,
    'utf-8'
  );
};
