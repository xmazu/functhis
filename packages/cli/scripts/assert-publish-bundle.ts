import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const bundlePath = path.join(packageRoot, 'dist/cli.js');
const authorTypesPath = path.join(packageRoot, 'dist/index.d.ts');
const nextBundlePath = path.join(packageRoot, 'dist/sdk/next.js');
const clientBundlePath = path.join(packageRoot, 'dist/sdk/client.js');

const FORBIDDEN = [
  '@functhis/db',
  'drizzle-orm',
  'node-pg',
  'drizzle',
] as const;

const fail = (message: string): never => {
  throw new Error(`publish bundle assert: ${message}`);
};

const assertNoForbidden = (label: string, content: string): void => {
  for (const marker of FORBIDDEN) {
    if (content.includes(marker)) {
      fail(`${label} must not contain "${marker}"`);
    }
  }
};

const content = await readFile(bundlePath, 'utf-8');

if (!content.startsWith('#!/usr/bin/env node')) {
  fail('dist/cli.js must start with #!/usr/bin/env node');
}

assertNoForbidden('dist/cli.js', content);

await Promise.all(
  [nextBundlePath, clientBundlePath].map(async (runtimePath) => {
    try {
      await access(runtimePath);
    } catch {
      fail(`missing ${path.basename(runtimePath)}`);
    }
    const runtimeContent = await readFile(runtimePath, 'utf-8');
    assertNoForbidden(path.basename(runtimePath), runtimeContent);
  })
);

const authorTypes = await readFile(authorTypesPath, 'utf-8');
if (!authorTypes.includes("declare module 'functhis:runtime'")) {
  fail('dist/index.d.ts must declare module functhis:runtime');
}

console.log('publish bundle assert: ok');
