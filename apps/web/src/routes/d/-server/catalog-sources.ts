import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';
import {
  acceptOpenApiGeneration,
  importOpenApiSource,
} from '@functhis/publish/openapi-sync';
import { syncRemoteMcpSource } from '@functhis/publish/remote-mcp-sync';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { env } from '#/env.server';
import { dashboardApiErrors } from '#/lib/errors/dashboard';
import { authMiddleware } from '#/middleware/auth';
import { getDb } from '#/services';

export const importOpenApiForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      credentialName: z.string().optional(),
      slug: z.string().min(1),
      spec: z.unknown(),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;
    const organizationId = context.session?.session.activeOrganizationId;
    if (!userId || !organizationId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Sign in required');
    }
    const database = await getDb();
    return importOpenApiSource({
      credentialName: data.credentialName,
      database,
      hot: asHotKvBinding(env.HOT),
      organizationId,
      ownerUserId: userId,
      slug: data.slug,
      spec: data.spec,
    });
  });

export const acceptSourceGenerationForSession = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .validator(z.object({ sourceId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;
    if (!userId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Sign in required');
    }
    const database = await getDb();
    await acceptOpenApiGeneration({ database, sourceId: data.sourceId });
    return { ok: true };
  });

export const importRemoteMcpForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      credentialName: z.string().optional(),
      endpoint: z.string().url(),
      slug: z.string().min(1),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user.id;
    const organizationId = context.session?.session.activeOrganizationId;
    if (!userId || !organizationId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Sign in required');
    }
    const database = await getDb();
    return syncRemoteMcpSource({
      credentialName: data.credentialName,
      database,
      endpoint: data.endpoint,
      hot: asHotKvBinding(env.HOT),
      organizationId,
      ownerUserId: userId,
      slug: data.slug,
    });
  });
