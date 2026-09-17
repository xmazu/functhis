import {
  formatFunctionId,
  getPackageBySlugs,
  listOwnerPackages,
  listRecentExecutions,
  publicFunctionPath,
  publicPackagePath,
} from '@functhis/deploy';
import { createServerFn } from '@tanstack/react-start';

import { env } from '@/env.server';
import { authMiddleware } from '@/middleware/auth';
import { getDb } from '@/services';

export const listPackagesForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user.id;
    if (!userId) {
      return [];
    }
    const database = await getDb();
    return listOwnerPackages(database, userId);
  });

export const getPackageDetailForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator((input: { slug: string }) => input)
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;
    const handle =
      context.session?.user &&
      'handle' in context.session.user &&
      typeof context.session.user.handle === 'string'
        ? context.session.user.handle
        : null;

    if (!userId || !handle) {
      return null;
    }

    const database = await getDb();
    const catalog = await getPackageBySlugs(database, handle, data.slug);
    if (!catalog || catalog.ownerUserId !== userId) {
      return null;
    }

    const executions = await listRecentExecutions(database, userId, catalog.id);
    const webOrigin = env.WEB_URL.replace(/\/$/u, '');
    const mcpResource = env.MCP_RESOURCE.replace(/\/$/u, '');

    return {
      executions,
      functions: catalog.functions.map((fn) => {
        const id = formatFunctionId({
          functionSlug: fn.functionSlug,
          handle: fn.handle,
          packageSlug: fn.packageSlug,
        });
        return {
          id,
          mcpSnippet: `POST ${mcpResource}/mcp\nTool: execute\nArguments: { "id": "${id}", "arguments": {} }`,
          slug: fn.functionSlug,
          url: `${webOrigin}${publicFunctionPath(fn)}`,
        };
      }),
      packageSlug: catalog.packageSlug,
      packageUrl: `${webOrigin}${publicPackagePath(catalog)}`,
      visibility: catalog.visibility,
    };
  });
