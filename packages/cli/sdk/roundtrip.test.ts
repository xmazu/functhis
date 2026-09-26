import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';

import { createClient } from './client';
import { createHandler } from './next';

describe('createHandler + createClient', () => {
  let previousFetch: typeof globalThis.fetch;

  beforeEach(() => {
    previousFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = previousFetch;
    vi.restoreAllMocks();
  });

  it('round-trips POST through the handler', async () => {
    const api = createHandler({
      functions: {
        echo: (input: { value: number }) => ({ value: input.value * 2 }),
      },
      token: 'shared-token',
    });

    globalThis.fetch = ((input, init) => {
      let url: string;
      if (input instanceof URL) {
        url = input.href;
      } else if (input instanceof Request) {
        ({ url } = input);
      } else {
        url = String(input);
      }
      const request = new Request(url, init);
      return api.POST(request);
    }) as typeof fetch;

    const client = createClient<typeof api>({
      token: 'shared-token',
      url: 'https://app.example.com',
    });

    await expect(client.echo({ value: 3 })).resolves.toEqual({ value: 6 });
  });
});
