import {
  buildPackageAccessContext,
  canAccessPackage,
  formatFunctionId,
  getPackageBySlugs,
  listAccessiblePackagesForUser,
  listRecentExecutions,
  publicFunctionPath,
  publicPackagePath,
  resolveOrganizationSlugById,
  updatePackageSharing,
} from '@functhis/publish';
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
    return listAccessiblePackagesForUser(database, userId);
  });

export const getPackageDetailForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator((input: { handle: string; slug: string }) => input)
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      return null;
    }

    const database = await getDb();
    const catalog = await getPackageBySlugs(database, data.handle, data.slug);
    if (!catalog) {
      return null;
    }

    const accessContext = await buildPackageAccessContext(database, userId);
    if (!canAccessPackage(catalog, accessContext)) {
      return null;
    }

    const organizationSlug =
      catalog.organizationId === null
        ? null
        : await resolveOrganizationSlugById(database, catalog.organizationId);

    const isOwner = catalog.ownerUserId === userId;
    const executions = isOwner
      ? await listRecentExecutions(database, userId, catalog.id)
      : [];
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
      isOwner,
      organizationId: catalog.organizationId,
      organizationSlug,
      packageSlug: catalog.packageSlug,
      packageUrl: `${webOrigin}${publicPackagePath(catalog)}`,
      visibility: catalog.visibility,
    };
  });

export const updatePackageSharingForSession = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .validator(
    (input: {
      handle: string;
      organizationSlug?: string;
      packageSlug: string;
      visibility: 'library' | 'organization' | 'private';
    }) => input
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const database = await getDb();
    const result = await updatePackageSharing(
      database,
      userId,
      data.handle,
      data.packageSlug,
      {
        organizationSlug: data.organizationSlug,
        visibility: data.visibility,
      }
    );
    if (!result.ok) {
      throw new Error(result.error);
    }

    return { ok: true as const };
  });
