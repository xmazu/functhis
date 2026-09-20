import { defineConfig } from 'drizzle-kit';
import 'varlock/auto-load';

/** Placeholder for static analysis; drizzle-kit needs a real URL at runtime. */
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://127.0.0.1:5432/functhis';

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: 'postgresql',
  out: './src/migrations',
  schema: './src/schema',
});
