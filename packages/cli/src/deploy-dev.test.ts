import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import { runDev } from './deploy';

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
});
