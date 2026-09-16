import { createTanstackAppViteConfig } from '@functhis/config/vite.tanstack-app';

export default createTanstackAppViteConfig(3001, 9229, {
  auxiliaryWorkers: [{ configPath: '../runtime/wrangler.jsonc' }],
});
