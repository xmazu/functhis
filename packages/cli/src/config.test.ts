import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CONSOLE_ORIGIN_PRODUCTION,
  DEPLOY_API_RESOURCE,
} from '@functhis/deploy/oauth';

import type { CliConfig } from './config';
import {
  resolveConfigPath,
  loadConfig,
  resolveConsoleUrl,
  resolveServiceUrl,
  resolveWebUrl,
  saveConfig,
} from './config';

let previousWebEnv: string | undefined;

beforeEach(() => {
  previousWebEnv = process.env.FUNCTHIS_WEB_URL;
});

afterEach(() => {
  if (previousWebEnv === undefined) {
    delete process.env.FUNCTHIS_WEB_URL;
  } else {
    process.env.FUNCTHIS_WEB_URL = previousWebEnv;
  }
});

describe('resolveServiceUrl', () => {
  test('prefers CLI flag over env and config', () => {
    process.env.FUNCTHIS_WEB_URL = 'https://env.example';
    expect(
      resolveServiceUrl({
        cliFlag: 'https://flag.example',
        configValue: 'https://config.example',
        envVar: 'FUNCTHIS_WEB_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://flag.example');
  });

  test('uses env when no flag', () => {
    process.env.FUNCTHIS_WEB_URL = 'https://env.example';
    expect(
      resolveServiceUrl({
        configValue: 'https://config.example',
        envVar: 'FUNCTHIS_WEB_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://env.example');
  });

  test('falls back to production default', () => {
    delete process.env.FUNCTHIS_WEB_URL;
    expect(
      resolveServiceUrl({
        envVar: 'FUNCTHIS_WEB_URL',
        productionDefault: 'https://prod.example',
      })
    ).toBe('https://prod.example');
  });
});

describe('resolveConsoleUrl', () => {
  test('defaults to production console origin', () => {
    const config: CliConfig = {
      accessToken: 'x',
      consoleUrl: 'http://localhost:3002',
      webUrl: 'http://localhost:3001',
    };
    expect(resolveConsoleUrl(null)).toBe(CONSOLE_ORIGIN_PRODUCTION);
    expect(resolveConsoleUrl(config)).toBe('http://localhost:3002');
  });
});

describe('resolveWebUrl', () => {
  test('defaults to deploy API resource origin', () => {
    expect(resolveWebUrl(null)).toBe(DEPLOY_API_RESOURCE);
  });
});

describe('loadConfig / saveConfig', () => {
  test('round-trips CLI config under HOME/.config/functhis', async () => {
    const previousHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), 'functhis-home-'));
    process.env.HOME = home;
    const sample: CliConfig = {
      accessToken: 'test-token',
      consoleUrl: 'http://localhost:3002',
      expiresAt: new Date(0).toISOString(),
      refreshToken: 'refresh',
      webUrl: 'http://localhost:3001',
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
});
