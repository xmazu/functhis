import { ExecutePayloadTooLargeError } from '@functhis/publish/quotas';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { log } from 'evlog';
import { z } from 'zod';

import { executeOwnedFunction, FunctionNotFoundError } from './execute-owned';
import { summarizeMcpSearchQuery } from './mcp-log';
import { searchFunctions } from './search';

const searchInputSchema = z.object({
  domain: z.enum(['library', 'mine', 'org']).optional(),
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
            'Find deployed functions by handle, package slug, function slug, contract text, or semantic similarity. domain: mine (default), org (organization-shared), library (public). Results include contract (description, examples, inputSchema, outputSchema). Use contract.inputSchema to build execute.arguments. Use the returned id with execute.',
          inputSchema: searchInputSchema,
        },
        async (input) => {
          const hits = await searchFunctions(env, {
            callerUserId: userId,
            domain: input.domain,
            query: input.query,
          });
          log.info({
            domain: input.domain ?? 'mine',
            hitCount: hits.length,
            message: 'mcp.search',
            query: summarizeMcpSearchQuery(input.query),
            userId,
          });
          return {
            content: [
              {
                text: JSON.stringify({ results: hits }, null, 2),
                type: 'text' as const,
              },
            ],
          };
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
              log.info({
                error: result.error,
                functionId: input.id,
                message: 'mcp.execute.failed',
                status: result.status,
                userId,
              });
              if (result.issues) {
                return toolErrorContent(
                  JSON.stringify({
                    error: result.error,
                    issues: result.issues,
                  })
                );
              }
              return toolErrorContent(result.error);
            }
            log.info({
              functionId: input.id,
              message: 'mcp.execute.ok',
              status: result.status,
              userId,
            });
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
              log.info({
                error: 'function_not_found',
                functionId: input.id,
                message: 'mcp.execute.failed',
                userId,
              });
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
    { legacy: 'stateless' }
  );
