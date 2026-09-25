import { RUNTIME_MODULE_ID } from '@functhis/runtime';
import type { Plugin } from 'esbuild';

export const runtimeExternalPlugin = (): Plugin => ({
  name: 'functhis-runtime-external',
  setup(build) {
    // eslint-disable-next-line require-unicode-regexp -- esbuild onResolve uses Go RE2, not JS RegExp flags
    build.onResolve({ filter: /^functhis:runtime$/ }, () => ({
      external: true,
      path: RUNTIME_MODULE_ID,
    }));
    // eslint-disable-next-line require-unicode-regexp -- esbuild onResolve uses Go RE2, not JS RegExp flags
    build.onResolve({ filter: /^\.\/__functhis_runtime\.mjs$/ }, () => ({
      external: true,
      path: RUNTIME_MODULE_ID,
    }));
  },
});
