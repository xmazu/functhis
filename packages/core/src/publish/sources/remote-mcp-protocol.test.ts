import { describe, expect, test } from 'bun:test';

import {
  buildRemoteMcpCallToolRequest,
  parseRemoteMcpTools,
  remoteMcpCacheFresh,
} from './remote-mcp-protocol';

describe('remote mcp protocol', () => {
  test('parses tools/list payloads', () => {
    expect(
      parseRemoteMcpTools({
        result: {
          tools: [
            {
              description: 'Find a user',
              inputSchema: { type: 'object' },
              name: 'search',
            },
          ],
        },
      })
    ).toEqual([
      {
        description: 'Find a user',
        inputSchema: { type: 'object' },
        name: 'search',
      },
    ]);
  });

  test('cache is fresh for 30s while ready', () => {
    const now = 100_000;
    expect(
      remoteMcpCacheFresh(
        { fetchedAtMs: now - 10_000, health: 'ready', tools: [] },
        now
      )
    ).toBe(true);
    expect(
      remoteMcpCacheFresh(
        { fetchedAtMs: now - 40_000, health: 'ready', tools: [] },
        now
      )
    ).toBe(false);
    expect(
      remoteMcpCacheFresh(
        { fetchedAtMs: now, health: 'failed', tools: [] },
        now
      )
    ).toBe(false);
  });

  test('builds a tools/call request', () => {
    expect(
      buildRemoteMcpCallToolRequest({
        arguments: { email: 'a@b.c' },
        name: 'search',
      })
    ).toEqual({
      id: 1,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { arguments: { email: 'a@b.c' }, name: 'search' },
    });
  });
});
