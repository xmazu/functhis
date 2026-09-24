import { describe, expect, test } from 'bun:test';

import { detectRuntimeSecretNames } from './runtime-secrets';

describe('detectRuntimeSecretNames', () => {
  test('collects secret() names from source files', () => {
    expect(
      detectRuntimeSecretNames({
        'index.ts':
          "import { secret } from 'functhis:runtime';\nsecret('API_KEY');",
        'other.ts': 'secret("OTHER")',
      })
    ).toEqual(['API_KEY', 'OTHER']);
  });

  test('returns sorted unique names', () => {
    expect(
      detectRuntimeSecretNames({
        'a.ts': "secret('Z'); secret('A'); secret('Z');",
      })
    ).toEqual(['A', 'Z']);
  });
});
