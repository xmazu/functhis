import evlog from 'evlog/nitro/v3';
import { defineConfig } from 'nitro';

/** Dev error UI + Nitro build hooks. Request logging uses `src/worker-entry.ts` on Cloudflare. */
export default defineConfig({
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: 'functhis-console' },
    }),
  ],
});
