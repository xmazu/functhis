import { readFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const bundlePath = path.join(packageRoot, 'dist/cli.js');
const authorTypesPath = path.join(packageRoot, 'dist/index.d.ts');

const FORBIDDEN = [
  '@functhis/db',
  'drizzle-orm',
  'node-pg',
  'drizzle',
] as const;

const fail = (message: string): never => {
  throw new Error(`publish bundle assert: ${message}`);
};

const content = await readFile(bundlePath, 'utf-8');

if (!content.startsWith('#!/usr/bin/env node')) {
  fail('dist/cli.js must start with #!/usr/bin/env node');
}

for (const marker of FORBIDDEN) {
  if (content.includes(marker)) {
    fail(`dist/cli.js must not contain "${marker}"`);
  }
}

const authorTypes = await readFile(authorTypesPath, 'utf-8');
if (!authorTypes.includes("declare module 'functhis:runtime'")) {
  fail('dist/index.d.ts must declare module functhis:runtime');
}

console.log('publish bundle assert: ok');
