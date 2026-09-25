import { internalMcpExecuteUrl } from '@functhis/publish';
import { z } from 'zod';

import { env } from '#/env.server';

const internalExecuteBodySchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  callerUserId: z.string().min(1).nullable(),
  id: z.string().min(1),
});

export interface ExecuteViaMcpInput {
  arguments?: Record<string, unknown>;
  callerUserId: string | null;
  id: string;
}

export const executeViaMcp = (input: ExecuteViaMcpInput): Promise<Response> => {
  const body = internalExecuteBodySchema.parse({
    arguments: input.arguments,
    callerUserId: input.callerUserId,
    id: input.id,
  });

  const request = new Request(internalMcpExecuteUrl, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'X-Functhis-Internal-Token': env.INTERNAL_EXECUTE_TOKEN,
    },
    method: 'POST',
  });

  return env.MCP.fetch(request);
};
