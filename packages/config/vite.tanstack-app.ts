import { cloudflare } from '@cloudflare/vite-plugin';
import type { PluginConfig } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';

type CloudflarePluginOptions = Omit<
  PluginConfig,
  'inspectorPort' | 'viteEnvironment'
>;

export const createTanstackAppViteConfig = (
  port: number,
  inspectorPort: number,
  cloudflareOptions?: CloudflarePluginOptions
): UserConfig =>
  defineConfig({
    build: {
      rollupOptions: {
        external: ['cloudflare:workers'],
      },
    },
    plugins: [
      cloudflare({
        inspectorPort,
        viteEnvironment: { name: 'ssr' },
        ...cloudflareOptions,
      }),
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
