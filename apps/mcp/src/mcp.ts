import { ExecutePayloadTooLargeError } from '@functhis/publish/quotas';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { log } from 'evlog';
import { z } from 'zod';

import { executeOwnedFunction, FunctionNotFoundError } from './execute-owned';
import type { ExecuteOwnedDependencies } from './execute-owned';
import { summarizeMcpSearchQuery } from './mcp-log';
import { searchFunctions } from './search';
import type { SearchFunctionsDependencies } from './search';

const searchInputSchema = z.object({
  domain: z.enum(['library', 'mine', 'org']).optional(),
  intents: z.array(z.string().trim().min(1)).max(5).optional(),
  query: z.string().optional(),
});

const executeInputSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  id: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
  searchId: z.string().min(1).optional(),
});

const toolErrorContent = (message: string, structured?: unknown) => ({
  content: [{ text: message, type: 'text' as const }],
  isError: true as const,
  ...(structured ? { structuredContent: structured } : {}),
});

export interface McpHandlerDependencies
  extends ExecuteOwnedDependencies, SearchFunctionsDependencies {
  searchFunctions?: typeof searchFunctions;
}

export const createFuncthisMcpHandler = (
  env: Env,
  userId: string,
  dependencies: McpHandlerDependencies = {}
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
            'Find capabilities for an agent goal. Describe the goal as short verb+object phrases (for example "greet a user", "send welcome email"). Put alternative phrasings in intents (up to 5). domain: mine (default), org (organization-shared), library (public). Results include contract (description, examples, inputSchema, outputSchema). Use contract.inputSchema to build execute.arguments. Use the returned id with execute. Pass searchId to execute when following a hit. reason "browse" means nothing ranked; pick from the listed contracts yourself or ask the user to clarify.',
          inputSchema: searchInputSchema,
        },
        async (input) => {
          const result = await (
            dependencies.searchFunctions ?? searchFunctions
          )(
            env,
            {
              callerUserId: userId,
              domain: input.domain,
              intents: input.intents,
              query: input.query,
            },
            undefined,
            dependencies
          );
          log.info({
            domain: input.domain ?? 'mine',
            hitCount: result.results.length,
            jevMs: result.timing.jevMs,
            lexicalMs: result.timing.lexicalMs,
            loadMs: result.timing.loadMs,
            message: 'mcp.search',
            query: summarizeMcpSearchQuery(input.query),
            reason: result.reason,
            searchId: result.searchId,
            userId,
            vectorMs: result.timing.vectorMs,
          });
          const payload = {
            ambiguous: result.ambiguous,
            reason: result.reason,
            results: result.results,
            searchId: result.searchId,
            timing: result.timing,
          };
          return {
            content: [
              {
                text: JSON.stringify(payload, null, 2),
                type: 'text' as const,
              },
            ],
            structuredContent: payload,
          };
        }
      );

      server.registerTool(
        'execute',
        {
          description:
            'Run a deployed function by id from search (for example @handle/package/function). Pass arguments as a JSON object matching contract.inputSchema from search when present; otherwise {} or omit. Optional searchId links this call to a prior search. Optional idempotencyKey replays a completed call.',
          inputSchema: executeInputSchema,
        },
        async (input) => {
          try {
            const result = await executeOwnedFunction(
              env,
              userId,
              {
                arguments: input.arguments,
                id: input.id,
                idempotencyKey: input.idempotencyKey,
                searchId: input.searchId,
              },
              dependencies
            );
            if (!result.ok) {
              log.info({
                error: result.error,
                functionId: input.id,
                message: 'mcp.execute.failed',
                status: result.status,
                userId,
              });
              const structured = result.issues
                ? {
                    error: result.error,
                    issues: result.issues,
                    timing: result.timing,
                  }
                : { error: result.error, timing: result.timing };
              return toolErrorContent(JSON.stringify(structured), structured);
            }
            log.info({
              functionId: input.id,
              message: 'mcp.execute.ok',
              status: result.status,
              userId,
            });
            let parsedBody: unknown = result.responseText;
            try {
              parsedBody = JSON.parse(result.responseText);
            } catch {
              parsedBody = result.responseText;
            }
            const structured = {
              body: parsedBody,
              status: result.status,
              timing: result.timing,
            };
            return {
              content: [
                {
                  text: JSON.stringify(structured),
                  type: 'text' as const,
                },
              ],
              isError: result.status >= 400,
              structuredContent: structured,
            };
          } catch (error) {
            if (error instanceof FunctionNotFoundError) {
              log.info({
                error: 'function_not_found',
                functionId: input.id,
                message: 'mcp.execute.failed',
                userId,
              });
              return toolErrorContent(JSON.stringify({ error: 'not_found' }), {
                error: 'not_found',
              });
            }
            if (error instanceof ExecutePayloadTooLargeError) {
              return toolErrorContent(error.message, {
                error: 'payload_too_large',
              });
            }
            throw error;
          }
        }
      );

      return server;
    },
    { legacy: 'stateless' }
  );
