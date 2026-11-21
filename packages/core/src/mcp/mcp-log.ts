const MAX_MCP_LOG_QUERY_CHARS = 120;

export const summarizeMcpSearchQuery = (query: string | undefined): string => {
  const trimmed = query?.trim() ?? '';
  if (trimmed.length <= MAX_MCP_LOG_QUERY_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_MCP_LOG_QUERY_CHARS)}…`;
};
