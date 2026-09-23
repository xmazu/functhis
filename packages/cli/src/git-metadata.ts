import { spawnSync } from 'node:child_process';

export interface GitBuildMetadata {
  gitCommit?: string;
  gitDirty: boolean;
}

export const readGitMetadata = (cwd: string): GitBuildMetadata => {
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf-8',
  });
  if (commit.status !== 0) {
    return { gitDirty: false };
  }

  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf-8',
  });
  const gitCommit = commit.stdout.trim() || undefined;
  const gitDirty = status.status === 0 && status.stdout.trim().length > 0;
  return { gitCommit, gitDirty };
};
