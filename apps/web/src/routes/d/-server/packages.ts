import {
  asHotKvBinding,
  buildPackageAccessContext,
  canAccessPackage,
  getPackageBySlugs,
  listAccessiblePackagesForUser,
  listRecentExecutions,
  resolveOrganizationSlugById,
  syncPackageToHot,
  updatePackageSharing,
} from '@functhis/publish';
import { createServerFn } from '@tanstack/react-start';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';
import { getDb } from '#/services';

import { buildPackageDetailViewModel } from './package-detail-view-model';

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

    const organizationSlug = await resolveOrganizationSlugById(
      database,
      catalog.organizationId
    );

    const isOwner = catalog.ownerUserId === userId;
    const executions = isOwner
      ? await listRecentExecutions(database, userId, catalog.id)
      : [];

    return buildPackageDetailViewModel({
      catalog,
      executions,
      isOwner,
      mcpResource: env.MCP_RESOURCE,
      organizationSlug,
    });
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
      visibility: 'organization' | 'private';
    }) => input
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const database = await getDb();
    const catalog = await getPackageBySlugs(
      database,
      data.handle,
      data.packageSlug
    );
    if (!catalog) {
      throw new Error('Package not found');
    }

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

    try {
      await syncPackageToHot(asHotKvBinding(env.HOT), database, catalog.id);
    } catch {
      // HOT is best-effort
    }

    return { ok: true as const };
  });
