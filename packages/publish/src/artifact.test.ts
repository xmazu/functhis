import { describe, expect, test } from 'bun:test';

import {
  artifactObjectKey,
  artifactPrefix,
  hashPublishArtifact,
} from './artifact';

describe('artifactPrefix', () => {
  test('nests the hash under sha256 and the first two characters', () => {
    const hash = 'abcdef0123456789';
    expect(artifactPrefix(hash)).toBe('artifacts/sha256/ab/abcdef0123456789');
    expect(artifactObjectKey(hash, 'bundle.mjs')).toBe(
      'artifacts/sha256/ab/abcdef0123456789/bundle.mjs'
    );
  });
});

describe('hashPublishArtifact', () => {
  test('is stable for the same files', async () => {
    const artifact = {
      buildJson: '{"cli":"0.1.0"}',
      bundle: 'export default {}',
      manifestJson: '{"package":"tools"}',
      sourceMap: '{}',
    };
    const first = await hashPublishArtifact(artifact);
    const second = await hashPublishArtifact(artifact);
    expect(first).toBe(second);
    expect(first).toMatch(/^[\da-f]{64}$/u);
  });
});
