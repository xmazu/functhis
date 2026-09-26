import { timingSafeEqual } from 'node:crypto';

import { API_PREFIX } from './protocol';
import type { FuncthisCallable } from './protocol';

export class FuncthisError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FuncthisError';
    this.status = status;
  }
}

declare const functhisFunctionsBrand: unique symbol;

export interface FuncthisApi<T extends Record<string, FuncthisCallable>> {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  [functhisFunctionsBrand]: T;
}

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

const parseBearerToken = (authorization: string | null): string | null => {
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(?<token>\S.*)$/iu.exec(authorization.trim());
  return match?.groups?.token ?? null;
};

const pathnameMatchesApi = (pathname: string): boolean =>
  pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

const getSlugFromPath = (pathname: string): string | null => {
  if (!pathnameMatchesApi(pathname)) {
    return null;
  }

  const rest = pathname.slice(API_PREFIX.length).replace(/^\/+/u, '');
  if (!rest) {
    return null;
  }

  return rest;
};

const requireBearerToken = (
  request: Request,
  expectedToken: string | undefined
): Response | null => {
  if (!expectedToken) {
    return Response.json(
      { error: 'Functhis API is not configured' },
      { headers: JSON_HEADERS, status: 500 }
    );
  }

  const providedToken = parseBearerToken(request.headers.get('authorization'));

  if (
    !providedToken ||
    Buffer.byteLength(providedToken) !== Buffer.byteLength(expectedToken) ||
    !timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))
  ) {
    return Response.json(
      { error: 'Unauthorized' },
      { headers: JSON_HEADERS, status: 401 }
    );
  }

  return null;
};

export const createHandler = <T extends Record<string, FuncthisCallable>>({
  functions,
  token,
}: {
  functions: T;
  token?: string;
}): FuncthisApi<T> => {
  const slugs = Object.keys(functions);

  const handler = async (request: Request): Promise<Response> => {
    const authError = requireBearerToken(request, token);
    if (authError) {
      return authError;
    }

    const { pathname } = new URL(request.url);
    const slug = getSlugFromPath(pathname);

    if (request.method === 'GET') {
      if (!pathnameMatchesApi(pathname)) {
        return Response.json(
          { error: 'Not found' },
          { headers: JSON_HEADERS, status: 404 }
        );
      }
      if (slug) {
        return Response.json(
          { error: 'Not found' },
          { headers: JSON_HEADERS, status: 404 }
        );
      }

      return Response.json(
        { functions: slugs.toSorted() },
        { headers: JSON_HEADERS, status: 200 }
      );
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { headers: JSON_HEADERS, status: 405 }
      );
    }

    if (!slug || !functions[slug]) {
      return Response.json(
        { error: 'Not found' },
        { headers: JSON_HEADERS, status: 404 }
      );
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON body' },
        { headers: JSON_HEADERS, status: 400 }
      );
    }

    try {
      const result = await functions[slug](input);
      try {
        return Response.json(result, { headers: JSON_HEADERS, status: 200 });
      } catch {
        return Response.json(
          { error: 'Response is not JSON-serializable' },
          { headers: JSON_HEADERS, status: 500 }
        );
      }
    } catch (error) {
      if (error instanceof FuncthisError) {
        return Response.json(
          { error: error.message },
          { headers: JSON_HEADERS, status: error.status }
        );
      }

      return Response.json(
        { error: 'Function execution failed' },
        { headers: JSON_HEADERS, status: 500 }
      );
    }
  };

  return {
    GET: handler,
    POST: handler,
  } as FuncthisApi<T>;
};
