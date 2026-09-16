import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { CLI_CLIENT_ID, DEPLOY_API_RESOURCE } from '@functhis/deploy';

export interface CliConfig {
  accessToken: string;
  consoleUrl: string;
  expiresAt?: string;
  refreshToken?: string;
  webUrl: string;
}

const defaultConsoleUrl = 'http://localhost:3002';
const defaultWebUrl = 'http://localhost:3001';

export const configPath = path.join(
  process.env.HOME ?? '~',
  '.config',
  'functhis',
  'config.json'
);

export const loadConfig = async (): Promise<CliConfig | null> => {
  try {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as CliConfig;
  } catch {
    return null;
  }
};

export const saveConfig = async (config: CliConfig): Promise<void> => {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
};

export const resolveConsoleUrl = (config: CliConfig | null): string =>
  config?.consoleUrl ?? defaultConsoleUrl;

export const resolveWebUrl = (config: CliConfig | null): string =>
  config?.webUrl ?? defaultWebUrl;
