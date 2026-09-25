import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';

import type { CliConfig } from './config';
import {
  parseCliConfig,
  resolveConfigPath,
  loadConfig,
  resolveServiceUrl,
  resolveUrl,
  saveConfig,
} from './config';

let previousUrlEnv: string | undefined;

beforeEach(() => {
  previousUrlEnv = process.env.FUNCTHIS_URL;
});

afterEach(() => {
  if (previousUrlEnv === undefined) {
    delete process.env.FUNCTHIS_URL;
  } else {
    process.env.FUNCTHIS_URL = previousUrlEnv;
  }
});

describe('resolveServiceUrl', () => {
  test('prefers CLI flag over env and config', () => {
    process.env.FUNCTHIS_URL = 'https://env.example';
    expect(
      resolveServiceUrl({
        cliFlag: 'https://flag.example',
        configValue: 'https://config.example',
        envVar: 'FUNCTHIS_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://flag.example');
  });

  test('uses env when no flag', () => {
    process.env.FUNCTHIS_URL = 'https://env.example';
    expect(
      resolveServiceUrl({
        configValue: 'https://config.example',
        envVar: 'FUNCTHIS_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://env.example');
  });

  test('falls back to production default', () => {
    delete process.env.FUNCTHIS_URL;
    expect(
      resolveServiceUrl({
        envVar: 'FUNCTHIS_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://prod.example');
  });
});

describe('resolveUrl', () => {
  test('defaults to the production origin', () => {
    const config: CliConfig = {
      accessToken: 'x',
      url: 'http://localhost:3001',
    };
    expect(resolveUrl(null)).toBe(PUBLISH_API_RESOURCE);
    expect(resolveUrl(config)).toBe('http://localhost:3001');
  });
});

describe('parseCliConfig', () => {
  test('reads url from a current config', () => {
    expect(
      parseCliConfig({
        accessToken: 'token',
        url: 'http://localhost:3001',
      })
    ).toEqual({
      accessToken: 'token',
      url: 'http://localhost:3001',
    });
  });

  test('accepts legacy webUrl and consoleUrl', () => {
    expect(
      parseCliConfig({
        accessToken: 'token',
        consoleUrl: 'http://localhost:3002',
        webUrl: 'http://localhost:3001',
      })
    ).toEqual({
      accessToken: 'token',
      url: 'http://localhost:3001',
    });
  });
});

describe('loadConfig / saveConfig', () => {
  test('round-trips CLI config under HOME/.config/functhis', async () => {
    const previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-home-'));
    process.env.HOME = home;
    const sample: CliConfig = {
      accessToken: 'test-token',
      expiresAt: new Date(0).toISOString(),
      refreshToken: 'refresh',
      url: 'http://localhost:3001',
    };
    try {
      await saveConfig(sample);
      await expect(loadConfig()).resolves.toEqual(sample);
      expect(resolveConfigPath().startsWith(home)).toBe(true);
    } finally {
      process.env.HOME = previousHome;
      await rm(home, { force: true, recursive: true });
    }
  });

  test('loads legacy consoleUrl/webUrl files as url', async () => {
    const previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-legacy-'));
    process.env.HOME = home;
    try {
      const configPath = resolveConfigPath();
      await mkdir(path.dirname(configPath), { recursive: true });
      await writeFile(
        configPath,
        `${JSON.stringify({
          accessToken: 'legacy',
          consoleUrl: 'http://localhost:3002',
          webUrl: 'http://localhost:3001',
        })}\n`,
        'utf-8'
      );
      await expect(loadConfig()).resolves.toEqual({
        accessToken: 'legacy',
        url: 'http://localhost:3001',
      });
    } finally {
      process.env.HOME = previousHome;
      await rm(home, { force: true, recursive: true });
    }
  });
});
