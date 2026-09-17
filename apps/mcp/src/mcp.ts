import { ExecutePayloadTooLargeError } from '@functhis/deploy';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { executeOwnedFunction, FunctionNotFoundError } from './execute-owned';
import { searchMine, UnsupportedSearchDomainError } from './search';

const searchInputSchema = z.object({
  domain: z.enum(['mine']).optional(),
  query: z.string().optional(),
});

const executeInputSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  id: z.string().min(1),
});

const toolErrorContent = (message: string) => ({
  content: [{ text: message, type: 'text' as const }],
  isError: true as const,
});

export const createFuncthisMcpHandler = (
  env: Env,
  userId: string
): ReturnType<typeof createMcpHandler> =>
  createMcpHandler(
    () => {
      const server = new McpServer({
        name: 'functhis-mcp',
        version: '0.1.0',
      });

      server.registerTool(
        'search',
        {
          description:
            'Find functions you own by package slug, function slug, handle, or optional JSDoc description. Results include contract.inputSchema when deploy extracted one — use it to build execute.arguments. Use the returned id with execute. Do not ask the user to paste @handle/package/function ids.',
          inputSchema: searchInputSchema,
        },
        async (input) => {
          try {
            const hits = await searchMine(env, {
              callerUserId: userId,
              domain: input.domain,
              query: input.query,
            });
            return {
              content: [
                {
                  text: JSON.stringify({ results: hits }, null, 2),
                  type: 'text' as const,
                },
              ],
            };
          } catch (error) {
            if (error instanceof UnsupportedSearchDomainError) {
              return toolErrorContent(error.message);
            }
            throw error;
          }
        }
      );

      server.registerTool(
        'execute',
        {
          description:
            'Run a deployed function by id from search (for example @handle/package/function). Pass arguments as a JSON object matching contract.inputSchema from search when present; otherwise {} or omit.',
          inputSchema: executeInputSchema,
        },
        async (input) => {
          try {
            const result = await executeOwnedFunction(env, userId, {
              arguments: input.arguments,
              id: input.id,
            });
            if (!result.ok) {
              return toolErrorContent(result.error);
            }
            return {
              content: [
                {
                  text: result.responseText,
                  type: 'text' as const,
                },
              ],
              isError: result.status >= 400,
            };
          } catch (error) {
            if (error instanceof FunctionNotFoundError) {
              return toolErrorContent('Function not found');
            }
            if (error instanceof ExecutePayloadTooLargeError) {
              return toolErrorContent(error.message);
            }
            throw error;
          }
        }
      );

      return server;
    },
    { legacy: 'reject' }
  );
