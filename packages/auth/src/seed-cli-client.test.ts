import { describe, expect, test } from 'bun:test';

import { PUBLISH_API_RESOURCE } from '@functhis/publish';

import { ensureCliOAuthClient } from './seed-cli-client';

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
  });
});
