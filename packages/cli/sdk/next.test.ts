import { afterEach, describe, expect, it, vi } from 'bun:test';

import { createHandler, FuncthisError } from './next';

describe('createHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing bearer token', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });
    const response = await api.GET(
      new Request('http://localhost/api/functhis')
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when token is not configured', async () => {
    const api = createHandler({ functions: {} });
    const response = await api.GET(
      new Request('http://localhost/api/functhis', {
        headers: { authorization: 'Bearer x' },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Functhis API is not configured',
    });
  });

  it('lists registered function slugs on GET', async () => {
    const api = createHandler({
      functions: {
        'get-wedding-details': () => ({ wedding: {} }),
        'list-weddings': () => ({ weddings: [] }),
      },
      token: 'test-token',
    });

    const response = await api.GET(
      new Request('http://localhost/api/functhis', {
        headers: { authorization: 'Bearer test-token' },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      functions: ['get-wedding-details', 'list-weddings'],
    });
  });

  it('returns 404 for GET on a path outside /api/functhis', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });
    const response = await api.GET(
      new Request('http://localhost/wrong', {
        headers: { authorization: 'Bearer test-token' },
      })
    );

    expect(response.status).toBe(404);
  });

  it('accepts a case-insensitive Bearer scheme', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });
    const response = await api.GET(
      new Request('http://localhost/api/functhis', {
        headers: { authorization: 'bearer test-token' },
      })
    );

    expect(response.status).toBe(200);
  });

  it('returns 404 for GET with slug', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });
    const response = await api.GET(
      new Request('http://localhost/api/functhis/echo', {
        headers: { authorization: 'Bearer test-token' },
      })
    );

    expect(response.status).toBe(404);
  });

  it('dispatches POST body to the matching function', async () => {
    const echo = vi.fn().mockResolvedValue({ ok: true });
    const api = createHandler({
      functions: { echo },
      token: 'test-token',
    });

    const response = await api.POST(
      new Request('http://localhost/api/functhis/echo', {
        body: JSON.stringify({ value: 1 }),
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(echo).toHaveBeenCalledWith({ value: 1 });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('returns 404 for unknown slug', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });
    const response = await api.POST(
      new Request('http://localhost/api/functhis/missing', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid JSON', async () => {
    const api = createHandler({
      functions: { echo: () => ({}) },
      token: 'test-token',
    });
    const response = await api.POST(
      new Request('http://localhost/api/functhis/echo', {
        body: '{',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    });
  });

  it('returns 500 when the handler result is not JSON-serializable', async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const api = createHandler({
      functions: {
        bad: () => circular,
      },
      token: 'test-token',
    });

    const response = await api.POST(
      new Request('http://localhost/api/functhis/bad', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Response is not JSON-serializable',
    });
  });

  it('maps FuncthisError to its status and unexpected errors to 500', async () => {
    const api = createHandler({
      functions: {
        badInput: () => {
          throw new Error('weddingId must not be empty');
        },
        notFound: () => {
          throw new FuncthisError('Wedding not found', 404);
        },
      },
      token: 'test-token',
    });

    const notFoundResponse = await api.POST(
      new Request('http://localhost/api/functhis/notFound', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );
    const badInputResponse = await api.POST(
      new Request('http://localhost/api/functhis/badInput', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({
      error: 'Wedding not found',
    });
    expect(badInputResponse.status).toBe(500);
    await expect(badInputResponse.json()).resolves.toEqual({
      error: 'Function execution failed',
    });
  });

  it('returns 500 for non-Error throws', async () => {
    const api = createHandler({
      functions: {
        broken: () => {
          const failure: unknown = 'oops';
          throw failure;
        },
      },
      token: 'test-token',
    });

    const response = await api.POST(
      new Request('http://localhost/api/functhis/broken', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Function execution failed',
    });
  });

  it('exports GET and POST handlers', async () => {
    const api = createHandler({ functions: {}, token: 'test-token' });

    const getResponse = await api.GET(
      new Request('http://localhost/api/functhis', {
        headers: { authorization: 'Bearer test-token' },
      })
    );
    const postResponse = await api.POST(
      new Request('http://localhost/api/functhis/echo', {
        body: '{}',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      })
    );

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(404);
  });
});
