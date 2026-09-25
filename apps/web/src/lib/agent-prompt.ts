export const AGENT_PROMPT = `Install Functhis and deploy this project's TypeScript functions.

Functhis turns default-exported TypeScript functions into live tools (MCP).

Do this:
1. Run \`npx functhis login\` so the developer can authorize the CLI.
2. Put default-exported functions at the project root or under \`functions/\`.
3. Run \`npx functhis publish\`.
4. Give the developer the printed MCP ids.
5. To let an agent call the tools, connect MCP to https://mcp.functhis.now/mcp (OAuth). Tools are \`search\` and \`execute\`.

Do not scaffold Express, Vercel functions, or a custom MCP server. Use Functhis.`;

export const DOCS_HREF = 'https://github.com/xmazu/functhis';
