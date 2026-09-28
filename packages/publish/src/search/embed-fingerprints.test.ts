import { describe, expect, test } from 'bun:test';

import {
  recordVectorEmbedFingerprint,
  shouldSkipVectorEmbed,
} from './embed-fingerprints';

const memoryHot = () => {
  const store = new Map<string, string>();
  return {
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};

describe('embed fingerprints', () => {
  test('skips unchanged text and re-embeds after a change', async () => {
    const hot = memoryHot();
    expect(
      await shouldSkipVectorEmbed({
        capabilityId: '@acme/crm/users/search',
        hot,
        text: 'Find a user by email',
      })
    ).toBe(false);
    await recordVectorEmbedFingerprint({
      capabilityId: '@acme/crm/users/search',
      hot,
      text: 'Find a user by email',
    });
    expect(
      await shouldSkipVectorEmbed({
        capabilityId: '@acme/crm/users/search',
        hot,
        text: 'Find a user by email',
      })
    ).toBe(true);
    expect(
      await shouldSkipVectorEmbed({
        capabilityId: '@acme/crm/users/search',
        hot,
        text: 'Find a user by name',
      })
    ).toBe(false);
  });
});
