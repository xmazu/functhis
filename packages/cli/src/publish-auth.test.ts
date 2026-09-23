import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runPublish } from './publish';

let previousHome: string | undefined;

afterEach(() => {
  process.env.HOME = previousHome;
});

describe('runPublish', () => {
  test('requires a saved login', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-no-config-'));
    process.env.HOME = home;
    try {
      await expect(
        runPublish({
          projectRoot: path.join(
            import.meta.dirname,
            '../../../examples/hello-world'
          ),
          slug: 'hello-world',
          webUrl: 'http://localhost:3001',
        })
      ).rejects.toThrow(/Not logged in/u);
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});
