import { afterEach, describe, expect, test } from 'bun:test';

import { fetchClientMetadataResource, validateCimdUrl } from './cimd-fetch';

const originalFetch = globalThis.fetch;

describe('validateCimdUrl', () => {
  test('accepts a valid HTTPS metadata URL', () => {
    const url = validateCimdUrl(
      'https://client.example.com/oauth/client-metadata.json'
    );
    expect(url.hostname).toBe('client.example.com');
  });

  test('rejects HTTP URLs', () => {
    expect(() =>
      validateCimdUrl('http://client.example.com/oauth/client-metadata.json')
    ).toThrow('HTTPS');
  });

  test('rejects URLs with embedded credentials', () => {
    expect(() =>
      validateCimdUrl(
        'https://user:pass@client.example.com/oauth/client-metadata.json'
      )
    ).toThrow('credentials');
  });

  test('rejects localhost hostnames', () => {
    expect(() =>
      validateCimdUrl('https://localhost/oauth/client-metadata.json')
    ).toThrow('special-use');
  });

  test('rejects loopback IPv4 literals', () => {
    expect(() =>
      validateCimdUrl('https://127.0.0.1/oauth/client-metadata.json')
    ).toThrow('special-use');
  });

  test('rejects private IPv4 literals', () => {
    expect(() =>
      validateCimdUrl('https://192.168.0.1/oauth/client-metadata.json')
    ).toThrow('special-use');
  });

  test('rejects root-only paths', () => {
    expect(() => validateCimdUrl('https://client.example.com/')).toThrow(
      'path'
    );
  });
});

describe('fetchClientMetadataResource', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('rejects non-GET methods', async () => {
    await expect(
      fetchClientMetadataResource(
        'https://client.example.com/oauth/client-metadata.json',
        { method: 'POST' }
      )
    ).rejects.toThrow('GET and HEAD');
  });

  test('uses redirect error and returns HEAD responses unchanged', async () => {
    let fetchInit: RequestInit | undefined;
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      fetchInit = init;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const response = await fetchClientMetadataResource(
      'https://client.example.com/oauth/client-metadata.json',
      { method: 'HEAD' }
    );

    expect(response.status).toBe(200);
    expect(fetchInit?.redirect).toBe('error');
    expect(fetchInit?.method).toBe('HEAD');
  });

  test('rejects metadata larger than the size cap', async () => {
    const largeChunk = new Uint8Array(6 * 1024);
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(largeChunk);
            controller.close();
          },
        }),
        { status: 200 }
      )) as typeof fetch;

    await expect(
      fetchClientMetadataResource(
        'https://client.example.com/oauth/client-metadata.json'
      )
    ).rejects.toThrow('size limit');
  });
});
