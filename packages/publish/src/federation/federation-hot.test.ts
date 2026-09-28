import { describe, expect, test } from 'bun:test';

import type { HotKvBinding } from '../http/http-context';
import {
  FEDERATION_BLOB_PREFIX,
  clearFederationIndexMemo,
  federationIndexHotKey,
  loadFederationEdgesForCapabilities,
  loadFederationIndex,
  projectFederationDocs,
  readFederationGeneration,
} from './federation-hot';
import type { FederationDoc } from './federation-index';

const memoryHot = (): HotKvBinding & { store: Map<string, string> } => {
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
    store,
  };
};

const doc = (overrides?: Partial<FederationDoc>): FederationDoc => ({
  availability: 'ready',
  contract: {
    description: 'Find a user by email',
    inputSchema: {
      properties: { email: { type: 'string' } },
      type: 'object',
    },
    reviewedAliases: ['customer'],
  },
  functionSlug: 'users/search',
  handle: 'acme',
  organizationId: 'org-1',
  ownerUserId: 'user-1',
  packageSlug: 'crm',
  searchText: 'users/search\nFind a user by email\nemail',
  visibility: 'private',
  ...overrides,
});

describe('projectFederationDocs', () => {
  test('writes one generation per batch and serves from memo', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc(), doc()]);
    expect(
      await readFederationGeneration(hot, {
        kind: 'org',
        organizationId: 'org-1',
      })
    ).toBe(1);
    const first = await loadFederationIndex(hot, {
      kind: 'org',
      organizationId: 'org-1',
    });
    expect(first?.index.capabilities).toHaveLength(1);
    expect(hot.store.has(`${FEDERATION_BLOB_PREFIX}org-1:1`)).toBe(true);
    const second = await loadFederationIndex(hot, {
      kind: 'org',
      organizationId: 'org-1',
    });
    expect(second?.index).toBe(first?.index);
  });

  test('second batch bumps the generation and deletes the old blob', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc()]);
    await projectFederationDocs(hot, [
      doc({ functionSlug: 'users/list', searchText: 'users/list' }),
    ]);
    expect(
      await readFederationGeneration(hot, {
        kind: 'org',
        organizationId: 'org-1',
      })
    ).toBe(2);
    expect(hot.store.get(federationIndexHotKey('org-1', 1))).toBeUndefined();
    const loaded = await loadFederationIndex(hot, {
      kind: 'org',
      organizationId: 'org-1',
    });
    expect(loaded?.index.capabilities).toHaveLength(2);
  });

  test('library docs are indexed in the library scope', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc({ visibility: 'library' })]);
    expect(await readFederationGeneration(hot, { kind: 'library' })).toBe(1);
    const loaded = await loadFederationIndex(hot, { kind: 'library' });
    expect(loaded?.index.capabilities).toHaveLength(1);
  });

  test('removes capabilities from library scope when visibility drops', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc({ visibility: 'library' })]);
    await projectFederationDocs(hot, [doc({ visibility: 'private' })]);
    const loaded = await loadFederationIndex(hot, { kind: 'library' });
    expect(loaded?.index.capabilities).toHaveLength(0);
  });

  test('parallel batches merge every capability into the org index', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await Promise.all([
      projectFederationDocs(hot, [
        doc({ functionSlug: 'users/a', searchText: 'users/a' }),
      ]),
      projectFederationDocs(hot, [
        doc({ functionSlug: 'users/b', searchText: 'users/b' }),
      ]),
    ]);
    const loaded = await loadFederationIndex(hot, {
      kind: 'org',
      organizationId: 'org-1',
    });
    expect(loaded?.index.capabilities).toHaveLength(2);
  });

  test('writes the federation blob before advancing generation', async () => {
    const store = new Map<string, string>();
    const events: string[] = [];
    const hot: HotKvBinding = {
      delete: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      put: (key: string, value: string) => {
        events.push(key);
        store.set(key, value);
        return Promise.resolve();
      },
    };
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc()]);
    const blobKey = federationIndexHotKey('org-1', 1);
    const genKey = 'gen:v1:org-1';
    const blobIdx = events.indexOf(blobKey);
    const genIdx = events.indexOf(genKey);
    expect(blobIdx).toBeGreaterThanOrEqual(0);
    expect(genIdx).toBeGreaterThan(blobIdx);
  });

  test('returns null when nothing was projected', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    expect(
      await loadFederationIndex(hot, {
        kind: 'org',
        organizationId: 'org-missing',
      })
    ).toBeNull();
  });

  test('returns null for a corrupt blob', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await hot.put('gen:v1:org-1', '7');
    await hot.put(federationIndexHotKey('org-1', 7), 'not-json');
    expect(
      await loadFederationIndex(hot, {
        kind: 'org',
        organizationId: 'org-1',
      })
    ).toBeNull();
  });

  test('skips docs without an organization', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc({ organizationId: null })]);
    expect(
      await readFederationGeneration(hot, {
        kind: 'org',
        organizationId: 'org-1',
      })
    ).toBe(0);
  });
});

describe('loadFederationEdgesForCapabilities', () => {
  test('synthesizes authoritative edges for the dashboard', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc()]);
    const edges = await loadFederationEdgesForCapabilities(hot, {
      capabilityIds: ['@acme/crm/users/search'],
      organizationId: 'org-1',
    });
    const types = new Set(edges.map((edge) => edge.type));
    expect(types.has('package_contains')).toBe(true);
    expect(types.has('exposes_action')).toBe(true);
    expect(types.has('has_parameter')).toBe(true);
    expect(types.has('reviewed_alias')).toBe(true);
    expect(edges.every((edge) => edge.organizationId === 'org-1')).toBe(true);
  });

  test('includes credential_for edges when secret names are provided', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [doc()]);
    const edges = await loadFederationEdgesForCapabilities(hot, {
      capabilityIds: ['@acme/crm/users/search'],
      organizationId: 'org-1',
      secretNames: ['API_KEY'],
    });
    expect(edges.some((edge) => edge.type === 'credential_for')).toBe(true);
  });

  test('returns no edges without an index', async () => {
    const hot = memoryHot();
    clearFederationIndexMemo();
    expect(
      await loadFederationEdgesForCapabilities(hot, {
        capabilityIds: ['@acme/crm/users/search'],
        organizationId: 'org-missing',
      })
    ).toEqual([]);
  });
});
