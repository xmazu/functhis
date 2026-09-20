import { spawn } from 'node:child_process';

const tryBunOpen = (url: string): boolean => {
  const bun = (globalThis as { Bun?: { open?: (target: string) => void } }).Bun;
  if (!bun?.open) {
    return false;
  }
  try {
    bun.open(url);
    return true;
  } catch {
    return false;
  }
};

const spawnDetached = (command: string, args: string[]): void => {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
};

export const openUrl = (url: string): void => {
  if (tryBunOpen(url)) {
    return;
  }

  if (process.platform === 'darwin') {
    spawnDetached('open', [url]);
    return;
  }
  if (process.platform === 'win32') {
    spawnDetached('cmd', ['/c', 'start', '', url]);
    return;
  }
  spawnDetached('xdg-open', [url]);
};
