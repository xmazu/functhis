#!/usr/bin/env bun

import { loadLocalDatabaseUrl } from './load-local-database-url';

const databaseUrl = loadLocalDatabaseUrl();

if (databaseUrl) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
    databaseUrl;
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error(
    'Usage: bun scripts/run-with-local-database-url.ts <command...>'
  );
  process.exit(1);
}

const child = Bun.spawn(command, {
  env: process.env,
  stderr: 'inherit',
  stdin: 'inherit',
  stdout: 'inherit',
});

const exitCode = await child.exited;
process.exit(exitCode ?? 1);
