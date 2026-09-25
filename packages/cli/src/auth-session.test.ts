import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ensureValidAccessToken } from './auth-session';
import type { CliConfig } from './config';
import { loadConfig } from './config';

let previousFetch: typeof fetch;
let previousHome: string | undefined;

beforeEach(() => {
  previousFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  process.env.HOME = previousHome;
});

describe('ensureValidAccessToken', () => {
  test('returns config unchanged when expiry is in the future', async () => {
    const config: CliConfig = {
      accessToken: 'token',
      consoleUrl: 'https://functhis.now',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      webUrl: 'https://functhis.now',
    };
    await expect(ensureValidAccessToken(config)).resolves.toBe(config);
  });

  test('returns config when expiresAt is omitted', async () => {
    const config: CliConfig = {
      accessToken: 'token',
      consoleUrl: 'https://functhis.now',
      webUrl: 'https://functhis.now',
    };
    await expect(ensureValidAccessToken(config)).resolves.toBe(config);
  });

  test('requires a refresh token when the access token is expired', async () => {
    const config: CliConfig = {
      accessToken: 'stale-token',
      consoleUrl: 'http://localhost:3001',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      webUrl: 'http://localhost:3001',
    };
    await expect(ensureValidAccessToken(config)).rejects.toThrow(
      /functhis login/u
    );
  });

  test('requires login when refresh fails', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-auth-fail-'));
    process.env.HOME = home;
    globalThis.fetch = ((): Promise<Response> =>
      Promise.resolve(new Response('nope', { status: 400 }))) as typeof fetch;

    const config: CliConfig = {
      accessToken: 'stale-token',
      consoleUrl: 'http://localhost:3001',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: 'refresh-me',
      webUrl: 'http://localhost:3001',
    };

    try {
      await expect(ensureValidAccessToken(config)).rejects.toThrow(
        /Failed to refresh access token/u
      );
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });

  test('refreshes an expired access token', async () => {
    previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-auth-refresh-'));
    process.env.HOME = home;

    globalThis.fetch = ((): Promise<Response> =>
      Promise.resolve(
        Response.json(
          {
            access_token: 'fresh-token',
            expires_in: 3600,
            refresh_token: 'new-refresh',
          },
          { status: 200 }
        )
      )) as typeof fetch;

    const config: CliConfig = {
      accessToken: 'stale-token',
      consoleUrl: 'http://localhost:3001',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: 'refresh-me',
      webUrl: 'http://localhost:3001',
    };

    try {
      const next = await ensureValidAccessToken(config);
      expect(next.accessToken).toBe('fresh-token');
      expect(next.refreshToken).toBe('new-refresh');
      const saved = await loadConfig();
      expect(saved?.accessToken).toBe('fresh-token');
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});
