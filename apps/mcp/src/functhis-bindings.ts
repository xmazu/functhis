import type { McpBindings } from '@functhis/core/mcp';

export type FuncthisMcpBindings = McpBindings & {
  CONSOLE_URL: string;
  MCP_RESOURCE: string;
};
