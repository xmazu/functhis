import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_ENV_PATH = join(import.meta.dirname, '../packages/db/.env');

export function parseEnvFile(contents: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const withoutExport = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length)
      : trimmed;
    const separatorIndex = withoutExport.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();
    let value = withoutExport.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      env[key] = value;
    }
  }

  return env;
}

export function loadLocalDatabaseUrl(): string | undefined {
  try {
    const contents = readFileSync(DB_ENV_PATH, 'utf-8');
    const databaseUrl = parseEnvFile(contents).DATABASE_URL;
    return databaseUrl && databaseUrl.length > 0 ? databaseUrl : undefined;
  } catch {
    return undefined;
  }
}
