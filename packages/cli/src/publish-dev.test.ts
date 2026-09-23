import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import { runDev } from './publish';

describe('runDev', () => {
  test('executes hello-world with JSON input', async () => {
    const projectRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    await expect(
      runDev({
        functionSlug: 'hello',
        input: { name: 'Coverage' },
        projectRoot,
      })
    ).resolves.toBeUndefined();
  });

  test('rejects an unknown function slug', async () => {
    const projectRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    await expect(
      runDev({
        functionSlug: 'missing',
        projectRoot,
      })
    ).rejects.toThrow(/Unknown function slug/u);
  });

  test('rejects input that does not match the contract', async () => {
    const projectRoot = path.join(
      import.meta.dirname,
      '../../../examples/hello-world'
    );
    await expect(
      runDev({
        functionSlug: 'hello',
        input: { name: 12 },
        projectRoot,
      })
    ).rejects.toThrow(/invalid_input/u);
  });
});
