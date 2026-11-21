import { z } from 'zod/v4';

// Wrangler/esbuild can evaluate MCP protocol schemas before zod/v4 classic init runs.
z.object({});
