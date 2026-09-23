import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { WORKER_COMPATIBILITY_DATE } from '@functhis/publish/constants';

import {
  buildPublishArtifact,
  hashFunctionSource,
  readLockfileHash,
} from './publish-artifact';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('buildPublishArtifact', () => {
  test('builds a four-file artifact with empty secrets', () => {
    const { artifact, manifest } = buildPublishArtifact({
      build: {
        builtAt: '2026-01-01T00:00:00.000Z',
        bundler: { name: 'esbuild', version: '0.25.0' },
        cliVersion: '0.1.0',
        gitDirty: false,
        runtimeVersion: WORKER_COMPATIBILITY_DATE,
      },
      bundle: {
        bundleHash: 'abc',
        mainModule: 'bundle.mjs',
        modules: { 'bundle.mjs': 'export default {};' },
        sourceMap: '{}',
      },
      files: { 'hello.ts': 'export default async () => ({});' },
      functions: [
        {
          contract: { description: 'hello' },
          exportName: 'default',
          path: 'hello.ts',
          slug: 'hello',
        },
      ],
      packageSlug: 'tools',
      scope: 'neroli',
    });

    expect(manifest.secrets).toEqual([]);
    expect(manifest.scope).toBe('neroli');
    expect(manifest.functions[0]?.sourceHash).toBe(
      hashFunctionSource('export default async () => ({});')
    );
    expect(artifact.bundle).toBe('export default {};');
    expect(JSON.parse(artifact.manifestJson)).toMatchObject({
      package: 'tools',
      secrets: [],
    });
  });
});

describe('readLockfileHash', () => {
  test('hashes the first lockfile that exists', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-lock-'));
    roots.push(root);
    const content = 'lockfile-v1\n';
    await writeFile(path.join(root, 'bun.lock'), content, 'utf-8');
    const hash = await readLockfileHash(root);
    expect(hash).toBe(createHash('sha256').update(content).digest('hex'));
  });

  test('returns undefined when no lockfile is present', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-lock-none-'));
    roots.push(root);
    expect(await readLockfileHash(root)).toBeUndefined();
  });
});
