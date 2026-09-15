import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';

export function createTanstackAppViteConfig(port: number): UserConfig {
  return defineConfig({
    build: {
      rollupOptions: {
        external: ['cloudflare:workers'],
      },
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      port,
    },
  });
}
