export const PUBLISH_API_RESOURCE = 'https://functhis.now';

export const MCP_RESOURCE_PRODUCTION = 'https://mcp.functhis.now';

export const CLI_CLIENT_ID = 'functhis-cli';

/** Pre-registered public OAuth client for Cursor MCP (static auth in `.cursor/mcp.json`). */
export const CURSOR_MCP_CLIENT_ID = 'functhis-cursor-mcp';

/** Cursor may send any of these; register all on the OAuth client (see Cursor MCP docs). */
export const CURSOR_MCP_REDIRECT_URIS = [
  'http://localhost:8787/callback',
  'cursor://anysphere.cursor-mcp/oauth/callback',
  'https://www.cursor.com/agents/mcp/oauth/callback',
] as const;
