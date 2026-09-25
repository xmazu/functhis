import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { readGitMetadata } from './git-metadata';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

const git = (cwd: string, args: string[]): void => {
  const result = spawnSync(
    'git',
    [
      '-c',
      'user.email=dev@example.com',
      '-c',
      'user.name=Dev',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'init.defaultBranch=main',
      ...args,
    ],
    {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        GIT_AUTHOR_EMAIL: 'dev@example.com',
        GIT_AUTHOR_NAME: 'Dev',
        GIT_COMMITTER_EMAIL: 'dev@example.com',
        GIT_COMMITTER_NAME: 'Dev',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git failed');
  }
};

describe('readGitMetadata', () => {
  test('returns no commit when git is absent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-git-'));
    roots.push(root);
    expect(readGitMetadata(root)).toEqual({ gitDirty: false });
  });

  test('records the commit hash and dirty flag', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'functhis-git-repo-'));
    roots.push(root);
    await mkdir(path.join(root, '_empty-git-template'));
    git(root, ['init', `--template=${path.join(root, '_empty-git-template')}`]);
    await rm(path.join(root, '_empty-git-template'), {
      force: true,
      recursive: true,
    });
    await writeFile(path.join(root, 'README.md'), 'hi\n', 'utf-8');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-m', 'init']);

    const clean = readGitMetadata(root);
    expect(clean.gitCommit).toMatch(/^[0-9a-f]{7,40}$/u);
    expect(clean.gitDirty).toBe(false);

    await writeFile(path.join(root, 'dirty.txt'), 'x\n', 'utf-8');
    const dirty = readGitMetadata(root);
    expect(dirty.gitCommit).toBe(clean.gitCommit);
    expect(dirty.gitDirty).toBe(true);
  });
});
