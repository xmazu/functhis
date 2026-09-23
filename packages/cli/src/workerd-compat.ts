import type { Plugin } from 'esbuild';

const BANNED_SPECIFIERS = new Set([
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'fs',
  'fs/promises',
  'http',
  'https',
  'inspector',
  'net',
  'os',
  'readline',
  'tls',
  'v8',
  'vm',
  'worker_threads',
]);

const SPECIFIER_PATTERN =
  /(?:from|import)\s*\(?\s*["'](?<specifier>[^"']+)["']/gu;

const normalizeSpecifier = (specifier: string): string =>
  specifier.replace(/^node:/u, '');

export const isBannedNodeSpecifier = (specifier: string): boolean =>
  BANNED_SPECIFIERS.has(normalizeSpecifier(specifier));

const nativeAddonError = (specifier: string) => ({
  errors: [
    {
      text: `Native addon "${specifier}" is not supported on Functhis (workerd).`,
    },
  ],
  path: specifier,
});

const bannedNodeError = (specifier: string) => ({
  errors: [
    {
      text: `Node module "${specifier}" is not available in Functhis isolates. Avoid filesystem, child_process, and other full-Node APIs.`,
    },
  ],
  path: specifier,
});

const dynamicImportError = (specifier: string) => ({
  errors: [
    {
      text: `Unsupported dynamic import "${specifier}". Functhis can only bundle static imports.`,
    },
  ],
  path: specifier,
});

export const workerdCompatibilityPlugin = (): Plugin => ({
  name: 'functhis-workerd-compat',
  setup(build) {
    // esbuild onResolve filters are Go RE2 and reject the JS unicode flag.
    // eslint-disable-next-line require-unicode-regexp
    build.onResolve({ filter: /\.node$/ }, (args) =>
      nativeAddonError(args.path)
    );

    // eslint-disable-next-line require-unicode-regexp
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (isBannedNodeSpecifier(args.path)) {
        return bannedNodeError(args.path);
      }
      if (args.kind !== 'dynamic-import' || args.path.startsWith('node:')) {
        return;
      }
      return dynamicImportError(args.path);
    });
  },
});

export const assertSourceHasNoBannedNodeImports = (code: string): void => {
  for (const match of code.matchAll(SPECIFIER_PATTERN)) {
    const { specifier } = match.groups ?? {};
    if (!specifier) {
      continue;
    }
    if (specifier.endsWith('.node')) {
      throw new Error(
        `Native addon "${specifier}" is not supported on Functhis (workerd).`
      );
    }
    if (isBannedNodeSpecifier(specifier)) {
      throw new Error(
        `Node module "${specifier}" is not available in Functhis isolates. Avoid filesystem, child_process, and other full-Node APIs.`
      );
    }
  }
  if (code.includes('process.dlopen')) {
    throw new Error('Bundle includes process.dlopen, which is not supported.');
  }
};

export const assertBundleHasNoBannedNodeImports = (code: string): void => {
  const leftover = code.matchAll(/from\s*["'](?<specifier>node:[^"']+)["']/gu);
  for (const match of leftover) {
    const { specifier } = match.groups ?? {};
    if (specifier && isBannedNodeSpecifier(specifier)) {
      throw new Error(
        `Bundle includes unsupported Node import "${specifier}".`
      );
    }
  }
  if (code.includes('process.dlopen')) {
    throw new Error('Bundle includes process.dlopen, which is not supported.');
  }
};
