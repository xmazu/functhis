/**
 * Sync Functhis plan catalog to Stripe and optionally write env / push Secrets Store.
 *
 *   STRIPE_SECRET_KEY=sk_test_... bun packages/auth/scripts/stripe-setup.ts
 *   ... --url https://functhis.now
 *   ... --write-env          # merge price IDs into apps/web/.env
 *   ... --push-secrets-store # wrangler secrets-store create/update (needs CF auth)
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { $ } from 'bun';

import {
  formatStripeCatalogEnv,
  syncStripeCatalog,
} from './sync-stripe-catalog';

const scriptDir = import.meta.dirname;
const webEnvPath = path.resolve(scriptDir, '../../../apps/web/.env');
const productionStoreId = 'fdcdd40afc4d41fbbc9f6ffbe99fce77';

const stripeSecretNames = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_DEVELOPER_MONTHLY',
  'STRIPE_PRICE_TEAM_MONTHLY',
  'STRIPE_PRO_PRICE_ID',
] as const;

const parseArgs = (): {
  pushSecretsStore: boolean;
  rotateWebhook: boolean;
  url: string | null;
  writeEnv: boolean;
} => {
  const args = process.argv.slice(2);
  let url: string | null = null;
  let writeEnv = false;
  let pushSecretsStore = false;
  let rotateWebhook = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--write-env') {
      writeEnv = true;
    } else if (arg === '--push-secrets-store') {
      pushSecretsStore = true;
    } else if (arg === '--rotate-webhook') {
      rotateWebhook = true;
    } else if (arg === '--url' && args[index + 1]) {
      url = args[index + 1] ?? null;
      index += 1;
    }
  }
  return { pushSecretsStore, rotateWebhook, url, writeEnv };
};

const mergeEnvLines = (existing: string, lines: string): string => {
  const updates = new Map<string, string>();
  for (const line of lines.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    updates.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of existing.split('\n')) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      const key = trimmed.slice(0, eq);
      if (updates.has(key)) {
        out.push(`${key}=${updates.get(key)}`);
        seen.add(key);
        continue;
      }
    }
    out.push(line);
  }
  for (const [key, value] of updates) {
    if (!seen.has(key)) {
      out.push(`${key}=${value}`);
    }
  }
  return `${out.join('\n').replace(/\n*$/u, '')}\n`;
};

const upsertSecretsStoreSecret = async (
  storeId: string,
  name: string,
  value: string
): Promise<void> => {
  try {
    await $`bunx wrangler secrets-store secret create ${storeId} --name ${name} --value ${value} --scopes workers --remote`.quiet();
  } catch {
    await $`bunx wrangler secrets-store secret update ${storeId} --name ${name} --value ${value} --scopes workers --remote`.quiet();
  }
};

const { pushSecretsStore, rotateWebhook, url, writeEnv } = parseArgs();

const catalog = await syncStripeCatalog();
const envBlock = formatStripeCatalogEnv(catalog);

console.log('\n# Stripe catalog price IDs\n');
console.log(envBlock);

if (writeEnv) {
  let existing = '';
  try {
    existing = await readFile(webEnvPath, 'utf-8');
  } catch {
    existing = '';
  }
  await writeFile(webEnvPath, mergeEnvLines(existing, envBlock), 'utf-8');
  console.log(`\nUpdated ${webEnvPath} with price IDs.`);
}

if (url) {
  const webhookArgs = [
    path.join(scriptDir, 'ensure-stripe-webhook.ts'),
    '--url',
    url,
  ];
  if (rotateWebhook) {
    webhookArgs.push('--rotate');
  }
  await $`bun ${webhookArgs}`.env(process.env);
}

if (pushSecretsStore) {
  const storeId =
    process.env.FUNCTHIS_SECRETS_STORE_ID?.trim() ?? productionStoreId;
  /* eslint-disable no-await-in-loop -- wrangler CLI upserts are run one secret at a time */
  for (const name of stripeSecretNames) {
    const value = process.env[name]?.trim();
    if (!value) {
      console.warn(`Skipping ${name} — not set in environment`);
      continue;
    }
    await upsertSecretsStoreSecret(storeId, name, value);
    console.log(`Synced Secrets Store secret ${name}`);
  }
}

console.log(
  '\nNext: set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in apps/web/.env, run with --url after web is deployed, then --push-secrets-store for production.'
);
