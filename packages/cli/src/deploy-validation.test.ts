import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { saveConfig } from './config';
import { runDeploy } from './deploy';

let previousHome: string | undefined;

afterEach(() => {
  process.env.HOME = previousHome;
});

describe('runDeploy validation', () => {
  test('rejects invalid package slug before calling the API', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-deploy-val-'));
    process.env.HOME = home;
    try {
      await saveConfig({
        accessToken: 'token',
        consoleUrl: 'http://localhost:3002',
        webUrl: 'http://localhost:3001',
      });
      await expect(
        runDeploy({
          projectRoot: path.join(
            import.meta.dirname,
            '../../../examples/hello-world'
          ),
          slug: 'Invalid_Slug',
        })
      ).rejects.toThrow(/Invalid package slug/u);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});
