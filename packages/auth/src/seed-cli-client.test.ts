import { describe, expect, test } from 'bun:test';

import { PUBLISH_API_RESOURCE } from '@functhis/publish';
import { CURSOR_MCP_CLIENT_ID } from '@functhis/publish/oauth';

import {
  ensureCliOAuthClient,
  ensureCursorMcpOAuthClient,
} from './seed-cli-client';

describe('ensureCliOAuthClient', () => {
  test('inserts deploy and MCP oauth resources', async () => {
    const insertedResources: string[] = [];
    const database = {
      insert: () => ({
        values: (row: { identifier: string }) => {
          insertedResources.push(row.identifier);
          return {
            onConflictDoNothing: async () => {},
          };
        },
      }),
    };

    await ensureCliOAuthClient(database as never, 'http://localhost:3003');

    expect(insertedResources).toContain(PUBLISH_API_RESOURCE);
    expect(insertedResources).toContain('http://localhost:3003');
    expect(insertedResources).toContain('http://localhost:3003/');
  });

  test('inserts Cursor MCP oauth client bound to the MCP resource', async () => {
    const clientRows: { clientId: string; redirectUris: string[] }[] = [];
    const clientResources: { clientId: string; resourceId: string }[] = [];
    const database = {
      insert: (_table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          if ('redirectUris' in row) {
            clientRows.push({
              clientId: row.clientId as string,
              redirectUris: row.redirectUris as string[],
            });
          }
          if ('resourceId' in row && row.clientId === CURSOR_MCP_CLIENT_ID) {
            clientResources.push({
              clientId: row.clientId as string,
              resourceId: row.resourceId as string,
            });
          }
          return {
            onConflictDoNothing: async () => {},
          };
        },
      }),
    };

    await ensureCursorMcpOAuthClient(
      database as never,
      'http://localhost:3003'
    );

    expect(clientRows).toEqual([
      expect.objectContaining({
        clientId: CURSOR_MCP_CLIENT_ID,
        redirectUris: expect.arrayContaining([
          'http://localhost:8787/callback',
        ]),
      }),
    ]);
    expect(clientResources).toEqual(
      expect.arrayContaining([
        {
          clientId: CURSOR_MCP_CLIENT_ID,
          resourceId: 'http://localhost:3003',
        },
        {
          clientId: CURSOR_MCP_CLIENT_ID,
          resourceId: 'http://localhost:3003/',
        },
      ])
    );
  });
});
