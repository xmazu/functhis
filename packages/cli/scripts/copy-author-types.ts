import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.dirname(import.meta.dirname);
const authorTypesRoot = path.join(packageRoot, 'author-types');
const distRoot = path.join(packageRoot, 'dist');

await mkdir(distRoot, { recursive: true });
await copyFile(
  path.join(authorTypesRoot, 'index.d.ts'),
  path.join(distRoot, 'index.d.ts')
);
await copyFile(
  path.join(authorTypesRoot, 'index.js'),
  path.join(distRoot, 'index.js')
);
