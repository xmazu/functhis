import { describe, expect, test } from 'bun:test';

import {
  isValidSecretName,
  mergeSecretValues,
  parseSecretNamesFromManifestJson,
} from './secret-names';

describe('isValidSecretName', () => {
  test('accepts author-style names', () => {
    expect(isValidSecretName('API_KEY')).toBe(true);
    expect(isValidSecretName('stripeToken')).toBe(true);
  });

  test('rejects empty, overlong, and illegal names', () => {
    expect(isValidSecretName('')).toBe(false);
    expect(isValidSecretName('1ABC')).toBe(false);
    expect(isValidSecretName('HAS-DASH')).toBe(false);
    expect(isValidSecretName('A'.repeat(65))).toBe(false);
  });
});

describe('parseSecretNamesFromManifestJson', () => {
  test('reads unique valid names from the CLI manifest', () => {
    expect(
      parseSecretNamesFromManifestJson(
        JSON.stringify({ secrets: ['Z', 'API_KEY', 'API_KEY', 'bad-name'] })
      )
    ).toEqual(['API_KEY', 'Z']);
  });

  test('returns an empty list for missing or invalid manifests', () => {
    expect(parseSecretNamesFromManifestJson('{}')).toEqual([]);
    expect(parseSecretNamesFromManifestJson('{')).toEqual([]);
    expect(parseSecretNamesFromManifestJson('"nope"')).toEqual([]);
  });
});

describe('mergeSecretValues', () => {
  test('lets package values override organization values', () => {
    expect(
      mergeSecretValues({ ORG_ONLY: 'o', SHARED: 'org' }, { SHARED: 'pkg' })
    ).toEqual({ ORG_ONLY: 'o', SHARED: 'pkg' });
  });
});
