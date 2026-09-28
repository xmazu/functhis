export interface RemoteMcpTool {
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
}

export interface RemoteMcpSnapshot {
  fetchedAtMs: number;
  health: 'degraded' | 'failed' | 'ready';
  tools: RemoteMcpTool[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

export const parseRemoteMcpTools = (payload: unknown): RemoteMcpTool[] => {
  const record = asRecord(payload);
  const result = asRecord(record?.result) ?? record;
  const tools = result?.tools;
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools.flatMap((tool) => {
    const item = asRecord(tool);
    if (!item || typeof item.name !== 'string') {
      return [];
    }
    const inputSchema = asRecord(item.inputSchema) ?? {
      additionalProperties: true,
      type: 'object',
    };
    return [
      {
        description:
          typeof item.description === 'string' ? item.description : item.name,
        inputSchema,
        name: item.name,
      },
    ];
  });
};

export const remoteMcpCacheFresh = (
  snapshot: RemoteMcpSnapshot | null,
  nowMs: number,
  ttlMs = 30_000
): boolean => {
  if (!snapshot || snapshot.health !== 'ready') {
    return false;
  }
  return nowMs - snapshot.fetchedAtMs < ttlMs;
};

export const buildRemoteMcpListToolsRequest = (): unknown => ({
  id: 1,
  jsonrpc: '2.0',
  method: 'tools/list',
  params: {},
});

export const buildRemoteMcpCallToolRequest = (input: {
  arguments: unknown;
  name: string;
}): unknown => ({
  id: 1,
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    arguments: input.arguments ?? {},
    name: input.name,
  },
});
