/// <reference types="@cloudflare/workers-types" />
/// <reference path="../cloudflare-env.d.ts" />
// For Cloudflare Workers, env is accessed via cloudflare:workers module
// Types are defined in cloudflare-env.d.ts from wrangler.jsonc bindings
export { env } from 'cloudflare:workers';
