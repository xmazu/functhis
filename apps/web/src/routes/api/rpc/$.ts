import { appRouter } from '@functhis/api/routers/index';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { createFileRoute } from '@tanstack/react-router';

import { createContext } from '../../../context';

const logHandlerError = (error: unknown) => {
  console.error(error);
};

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logHandlerError)],
});

const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [onError(logHandlerError)],
});

const handle = async ({ request }: { request: Request }) => {
  const rpcResult = await rpcHandler.handle(request, {
    prefix: '/api/rpc',
    context: createContext({ req: request }),
  });
  if (rpcResult.response) {
    return rpcResult.response;
  }

  const apiResult = await apiHandler.handle(request, {
    prefix: '/api/rpc/api-reference',
    context: createContext({ req: request }),
  });
  if (apiResult.response) {
    return apiResult.response;
  }

  return new Response('Not found', { status: 404 });
};

export const Route = createFileRoute('/api/rpc/$')({
  server: {
    handlers: {
      HEAD: handle,
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
});
