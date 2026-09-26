import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { createClient } from './client';
import { createHandler } from './next';

describe('createClient', () => {
  let previousFetch: typeof globalThis.fetch;

  beforeEach(() => {
    previousFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = previousFetch;
    vi.restoreAllMocks();
  });

  it('calls POST /api/functhis/<slug> with JSON input', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true }, { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createClient({
      token: 'test-token',
      url: 'https://dashboard.example.com',
    });

    await expect(client.echo({ value: 1 })).resolves.toEqual({ ok: true });

    const [endpoint, requestInit] = fetchMock.mock.calls[0] as [
      URL,
      RequestInit,
    ];

    expect(new URL(endpoint).pathname).toBe('/api/functhis/echo');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(requestInit.body))).toEqual({ value: 1 });
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws the response error string when status is not OK', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: 'Not found' }, { status: 404 })
      ) as typeof fetch;

    const client = createClient({
      token: 'test-token',
      url: 'https://dashboard.example.com',
    });

    await expect(client.missing({})).rejects.toThrow('Not found');
  });

  it('throws when a successful response is not valid JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('not json', {
        headers: { 'Content-Type': 'text/plain' },
        status: 200,
      })
    ) as typeof fetch;

    const client = createClient({
      token: 'test-token',
      url: 'https://dashboard.example.com',
    });

    await expect(client.echo({})).rejects.toThrow(
      'Functhis response was not valid JSON'
    );
  });

  it('rejects empty url or token', () => {
    expect(() => createClient({ token: 'x', url: '   ' })).toThrow(
      'url must not be empty'
    );
    expect(() =>
      createClient({ token: '  ', url: 'https://example.com' })
    ).toThrow('token must not be empty');
  });
});

describe('createClient typing', () => {
  it('infers slug keys from createHandler return type', () => {
    const api = createHandler({
      functions: {
        'list-weddings': (input: { brideName?: string }) => ({
          weddings: [input.brideName ?? ''],
        }),
      },
      token: 't',
    });

    const client = createClient<typeof api>({
      token: 't',
      url: 'https://example.com',
    });

    type ListWeddings = (typeof client)['list-weddings'];
    type Input = Parameters<ListWeddings>[0];
    type Output = Awaited<ReturnType<ListWeddings>>;

    const assertInput: Input = { brideName: 'Anna' };
    const assertOutput: Output = { weddings: ['Anna'] };

    expect(assertInput.brideName).toBe('Anna');
    expect(assertOutput.weddings).toEqual(['Anna']);
    expect(api.GET).toBeTypeOf('function');
  });
});
