import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';

export { CLI_CLIENT_ID, PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';

export interface CliConfig {
  accessToken: string;
  expiresAt?: string;
  refreshToken?: string;
  url: string;
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

export const resolveUrl = (
  config: CliConfig | null,
  cliFlag?: string
): string =>
  resolveServiceUrl({
    cliFlag,
    configValue: config?.url,
    envVar: 'FUNCTHIS_URL',
    productionDefault: PUBLISH_API_RESOURCE,
  });

const readStoredString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const parseCliConfig = (value: unknown): CliConfig | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const stored = value as Record<string, unknown>;
  const accessToken = readStoredString(stored.accessToken);
  const url =
    readStoredString(stored.url) ??
    readStoredString(stored.webUrl) ??
    readStoredString(stored.consoleUrl);
  if (!accessToken || !url) {
    return null;
  }
  const expiresAt = readStoredString(stored.expiresAt);
  const refreshToken = readStoredString(stored.refreshToken);
  return {
    accessToken,
    url,
    ...(expiresAt ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
};

export const loadConfig = async (): Promise<CliConfig | null> => {
  try {
    const raw = await readFile(resolveConfigPath(), 'utf-8');
    return parseCliConfig(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveConfig = async (config: CliConfig): Promise<void> => {
  const filePath = resolveConfigPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
};
