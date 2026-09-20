import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CONSOLE_ORIGIN_PRODUCTION,
  DEPLOY_API_RESOURCE,
} from '@functhis/deploy/oauth';

export { CLI_CLIENT_ID, DEPLOY_API_RESOURCE } from '@functhis/deploy/oauth';

export interface CliConfig {
  accessToken: string;
  consoleUrl: string;
  expiresAt?: string;
  refreshToken?: string;
  webUrl: string;
}

export interface ResolveUrlOptions {
  cliFlag?: string;
  configValue?: string;
  envVar: string;
  productionDefault: string;
}

export const resolveConfigPath = (): string =>
  path.join(process.env.HOME ?? '~', '.config', 'functhis', 'config.json');

export const resolveServiceUrl = (options: ResolveUrlOptions): string => {
  if (options.cliFlag) {
    return options.cliFlag;
  }
  const fromEnv = process.env[options.envVar];
  if (fromEnv) {
    return fromEnv;
  }
  if (options.configValue) {
    return options.configValue;
  }
  return options.productionDefault;
};

export const resolveConsoleUrl = (
  config: CliConfig | null,
  cliFlag?: string
): string =>
  resolveServiceUrl({
    cliFlag,
    configValue: config?.consoleUrl,
    envVar: 'FUNCTHIS_CONSOLE_URL',
    productionDefault: CONSOLE_ORIGIN_PRODUCTION,
  });

export const resolveWebUrl = (
  config: CliConfig | null,
  cliFlag?: string
): string =>
  resolveServiceUrl({
    cliFlag,
    configValue: config?.webUrl,
    envVar: 'FUNCTHIS_WEB_URL',
    productionDefault: DEPLOY_API_RESOURCE,
  });

export const loadConfig = async (): Promise<CliConfig | null> => {
  try {
    const raw = await readFile(resolveConfigPath(), 'utf-8');
    return JSON.parse(raw) as CliConfig;
  } catch {
    return null;
  }
};

export const saveConfig = async (config: CliConfig): Promise<void> => {
  const filePath = resolveConfigPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
};
