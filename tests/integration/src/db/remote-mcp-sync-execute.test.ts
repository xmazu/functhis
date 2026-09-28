import { afterEach, describe, expect, test } from 'bun:test';

import { pkg } from '@functhis/db/schema/catalog';
import { dispatchExecute } from '@functhis/mcp/execute-dispatch';
import { formatFunctionId } from '@functhis/publish/function-id';
import {
  mcpSnapshotHotKey,
  functionHotKeyFromId,
} from '@functhis/publish/hot-keys';
import { syncRemoteMcpSource } from '@functhis/publish/remote-mcp-sync';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { stubGlobalFetch } from '../harness/fetch-stub';
import {
  createIntegrationMcpEnv,
  integrationHotBinding,
} from '../harness/mcp-env';
import { createMemoryHotKv } from '../harness/memory-hot-kv';
import { seedIntegrationPublishAuth } from '../harness/seed';

describe('remote MCP sync and execute', () => {
  let restoreFetch: (() => void) | undefined;

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
  });

  test('syncs injected tools and executes via stubbed tools/call', async () => {
    const db = await integrationDb();
    const memoryHot = createMemoryHotKv();
    const hot = integrationHotBinding(memoryHot);
    const env = createIntegrationMcpEnv(memoryHot);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, organizationId, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );
    const sourceSlug = `mcp-${suffix}`;

    const synced = await syncRemoteMcpSource({
      database: db,
      endpoint: 'https://mcp.example.test/mcp',
      hot,
      organizationId,
      ownerUserId: userId,
      slug: sourceSlug,
      tools: [
        {
          description: 'Echo input back',
          inputSchema: { type: 'object' },
          name: 'echo',
        },
      ],
    });
    expect(synced.health).toBe('ready');

    const [packageRow] = await db
      .select({ sourceKind: pkg.sourceKind })
      .from(pkg)
      .where(eq(pkg.id, synced.packageId))
      .limit(1);
    expect(packageRow?.sourceKind).toBe('remote_mcp_tool');

    const snapshot = await memoryHot.get(mcpSnapshotHotKey(synced.sourceId));
    expect(snapshot).toContain('"echo"');

    const capabilityId = formatFunctionId({
      functionSlug: 'echo',
      handle,
      packageSlug: sourceSlug,
    });
    const hotDoc = await memoryHot.get(functionHotKeyFromId(capabilityId));
    expect(hotDoc).toContain('"sourceKind":"remote_mcp_tool"');

    restoreFetch = stubGlobalFetch((_input, init) => {
      const body =
        typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      expect(body?.method).toBe('tools/call');
      expect(body?.params?.name).toBe('echo');
      return Response.json({
        jsonrpc: '2.0',
        result: { content: [{ text: '{"ok":true}' }] },
      });
    });

    const result = await dispatchExecute(env, userId, {
      arguments: { message: 'hi' },
      id: capabilityId,
    });
    expect(result.ok).toBe(true);
    expect(result.bodyText).toContain('ok');
  });

  test('failed list sync leaves no executable tools in HOT', async () => {
    const db = await integrationDb();
    const memoryHot = createMemoryHotKv();
    const hot = integrationHotBinding(memoryHot);
    const env = createIntegrationMcpEnv(memoryHot);
    const suffix = crypto.randomUUID().slice(0, 8);
    const { handle, organizationId, userId } = await seedIntegrationPublishAuth(
      db,
      suffix
    );
    const sourceSlug = `mcp-fail-${suffix}`;

    restoreFetch = stubGlobalFetch(() => new Response('fail', { status: 500 }));

    const synced = await syncRemoteMcpSource({
      database: db,
      endpoint: 'https://mcp.example.test/mcp',
      hot,
      organizationId,
      ownerUserId: userId,
      slug: sourceSlug,
    });
    expect(synced.health).toBe('failed');

    const capabilityId = formatFunctionId({
      functionSlug: 'echo',
      handle,
      packageSlug: sourceSlug,
    });
    await expect(
      dispatchExecute(env, userId, { arguments: {}, id: capabilityId })
    ).rejects.toThrow('Function not found');
  });
});
