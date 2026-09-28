import { describe, expect, test } from 'bun:test';

import { executeHostedAdapter } from './execute-hosted';
import { callOpenApiOperation, callRemoteMcpTool } from './execute-http';

const env = {} as Env;
const baseDoc = {
  bundleHash: 'bundle',
  contract: null,
  functionId: 'function',
  functionSlug: 'fn',
  handle: 'owner',
  ownerUserId: 'user',
  packageId: 'package',
  packageSlug: 'pkg',
  versionId: 'version',
  visibility: 'private' as const,
};

describe('execute adapters', () => {
  test('returns not found when hosted ownership is incomplete', async () => {
    const result = await executeHostedAdapter(env, {
      callerUserId: null,
      doc: baseDoc,
      parsedId: { functionSlug: 'fn', handle: 'owner', packageSlug: 'pkg' },
      requestBytes: 10,
      runInput: {},
    });
    expect(result.error).toBe('not_found');
    expect(result.status).toBe(404);
  });

  test('returns unavailable when OpenAPI metadata is incomplete', async () => {
    const result = await callOpenApiOperation(env, {
      callerUserId: null,
      doc: baseDoc,
      requestBytes: 10,
      runInput: {},
    });
    expect(result.error).toBe('source_unavailable');
    expect(result.retryable).toBe(true);
  });

  test('returns unavailable when remote MCP metadata is incomplete', async () => {
    const result = await callRemoteMcpTool(env, {
      callerUserId: null,
      doc: baseDoc,
      requestBytes: 10,
      runInput: {},
    });
    expect(result.error).toBe('source_unavailable');
    expect(result.retryable).toBe(true);
  });
});
