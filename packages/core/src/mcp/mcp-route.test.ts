import { describe, expect, test } from 'bun:test';

import type { McpBindings } from './bindings';
import { createMcpPostHandler } from './mcp-route';

describe('createMcpPostHandler', () => {
  test('returns 501 when authenticate is not configured', async () => {
    const handlePost = createMcpPostHandler();
    const response = await handlePost(
      new Request('http://localhost/mcp', { method: 'POST' }),
      {} as McpBindings
    );
    expect(response.status).toBe(501);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('authentication_required');
  });
});
