import { afterEach, describe, expect, test } from 'bun:test';

import { mcpSnapshotHotKey } from './hot-keys';
import type { HotKvBinding } from './http-context';
import {
  fetchRemoteMcpTools,
  invalidateRemoteMcpSnapshot,
  peekRemoteMcpSnapshot,
} from './remote-mcp-sync';

const originalFetch = globalThis.fetch;

const memoryHot = (): HotKvBinding => {
  const values = new Map<string, string>();
  return {
    delete: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(values.get(key) ?? null),
    put: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('remote MCP sync helpers', () => {
  test('reads and invalidates a snapshot', async () => {
    const hot = memoryHot();
    await hot.put(
      mcpSnapshotHotKey('source'),
      JSON.stringify({ fetchedAtMs: Date.now(), health: 'ready', tools: [] })
    );
    expect(await peekRemoteMcpSnapshot(hot, 'source')).toMatchObject({
      health: 'ready',
    });
    await invalidateRemoteMcpSnapshot(hot, 'source');
    expect(await peekRemoteMcpSnapshot(hot, 'source')).toBeNull();
  });

  test('fetches and parses tools from a remote endpoint', async () => {
    globalThis.fetch = () =>
      Response.json({
        result: {
          tools: [{ inputSchema: {}, name: 'search' }],
        },
      });
    await expect(
      fetchRemoteMcpTools('https://remote.test/mcp', {})
    ).resolves.toEqual([
      {
        description: 'search',
        inputSchema: {},
        name: 'search',
      },
    ]);
  });

  test('reports a non-successful list response', async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response('failed', { status: 503 }));
    await expect(
      fetchRemoteMcpTools('https://remote.test/mcp', {})
    ).rejects.toThrow('Remote MCP list failed (503)');
  });
});
