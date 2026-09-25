import './ensure-zod-init';
import { describe, expect, test } from 'bun:test';

import { createFuncthisMcpHandler } from './mcp';

const LEGACY_PROTOCOL_VERSIONS = [
  '2024-10-07',
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  '2025-11-25',
] as const;

const MODERN_PROTOCOL_VERSION = '2026-07-28';
const UNSUPPORTED_PROTOCOL_VERSION = -32_022;

const stubEnv = {
  CONSOLE_URL: 'http://localhost:3001',
  MCP_RESOURCE: 'http://localhost:3003',
} as Env;

const handler = () => createFuncthisMcpHandler(stubEnv, 'user_test');

const mcpPost = (body: unknown, extraHeaders: HeadersInit = {}): Request =>
  new Request('http://localhost:3003/mcp', {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    method: 'POST',
  });

const parseJsonRpc = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (contentType.includes('text/event-stream')) {
    const payloads = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter((line) => line.length > 0 && line !== '[DONE]')
      .map((line) => JSON.parse(line) as unknown);
    const last = payloads.at(-1);
    if (last === undefined) {
      throw new Error(`No SSE JSON-RPC payload in: ${text}`);
    }
    return last;
  }
  return JSON.parse(text) as unknown;
};

const jsonRpcError = (
  message: unknown
): { code?: number; data?: { supported?: unknown } } | undefined => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('error' in message)
  ) {
    return undefined;
  }
  const { error } = message as { error: unknown };
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return error as { code?: number; data?: { supported?: unknown } };
};

const jsonRpcResult = (
  message: unknown
): Record<string, unknown> | undefined => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('result' in message)
  ) {
    return undefined;
  }
  const { result } = message as { result: unknown };
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  return result as Record<string, unknown>;
};

describe('MCP protocol handshake', () => {
  test('accepts Codex initialize for 2025-06-18', async () => {
    const response = await handler().fetch(
      mcpPost({
        id: 1,
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          capabilities: {},
          clientInfo: { name: 'codex', version: 'test' },
          protocolVersion: '2025-06-18',
        },
      })
    );

    expect(response.ok).toBe(true);
    const message = await parseJsonRpc(response);
    expect(jsonRpcError(message)?.code).not.toBe(UNSUPPORTED_PROTOCOL_VERSION);
    const protocolVersion = jsonRpcResult(message)?.protocolVersion;
    expect(typeof protocolVersion).toBe('string');
    expect(protocolVersion).not.toBe(MODERN_PROTOCOL_VERSION);
    expect(LEGACY_PROTOCOL_VERSIONS).toContain(protocolVersion);
  });

  test('serves modern 2026-07-28 server/discover', async () => {
    const response = await handler().fetch(
      mcpPost(
        {
          id: 2,
          jsonrpc: '2.0',
          method: 'server/discover',
          params: {
            _meta: {
              'io.modelcontextprotocol/clientCapabilities': {},
              'io.modelcontextprotocol/clientInfo': {
                name: 'codex',
                version: 'test',
              },
              'io.modelcontextprotocol/protocolVersion':
                MODERN_PROTOCOL_VERSION,
            },
          },
        },
        {
          'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
          'Mcp-Method': 'server/discover',
        }
      )
    );

    expect(response.ok).toBe(true);
    const message = await parseJsonRpc(response);
    expect(jsonRpcError(message)?.code).not.toBe(UNSUPPORTED_PROTOCOL_VERSION);
    const result = jsonRpcResult(message);
    expect(result).toBeDefined();
    expect(result?.supportedVersions).toEqual(
      expect.arrayContaining([MODERN_PROTOCOL_VERSION])
    );
  });
});
