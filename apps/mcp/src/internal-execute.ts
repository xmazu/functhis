import {
  ExecutePayloadTooLargeError,
  INTERNAL_MCP_EXECUTE_HOST,
} from '@functhis/deploy';
import { z } from 'zod';

import { executeOwnedFunction, FunctionNotFoundError } from './execute-owned';

const internalExecuteBodySchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  callerUserId: z.string().min(1).nullable(),
  id: z.string().min(1),
});

export const handleInternalExecute = async (
  request: Request,
  env: Env
): Promise<Response> => {
  const url = new URL(request.url);
  if (url.hostname !== INTERNAL_MCP_EXECUTE_HOST) {
    return new Response('Not Found', { status: 404 });
  }

  const token = request.headers.get('X-Functhis-Internal-Token');
  if (token !== env.INTERNAL_EXECUTE_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = internalExecuteBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const result = await executeOwnedFunction(env, parsed.data.callerUserId, {
      arguments: parsed.data.arguments,
      id: parsed.data.id,
    });

    if (!result.ok) {
      const errorBody =
        result.issues === undefined
          ? { error: result.error }
          : { error: result.error, issues: result.issues };
      return Response.json(errorBody, { status: result.status });
    }

    return new Response(result.responseText, {
      headers: { 'Content-Type': 'application/json' },
      status: result.status,
    });
  } catch (error) {
    if (error instanceof FunctionNotFoundError) {
      return new Response('Not Found', { status: 404 });
    }
    if (error instanceof ExecutePayloadTooLargeError) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    throw error;
  }
};
