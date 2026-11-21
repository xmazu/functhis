import {
  deleteOrganizationSecret,
  deletePackageSecret,
  getPackageBySlugs,
  HostedSecretError,
  listOrganizationSecrets,
  setOrganizationSecret,
  setPackageSecret,
} from '@functhis/core/publish';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { env } from '#/env.server';
import { dashboardApiErrors } from '#/lib/errors/dashboard';
import { authMiddleware } from '#/middleware/auth';
import { getCatalog } from '#/services';

const secretNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/u);

const rethrowHostedSecretError = (error: unknown): never => {
  if (error instanceof HostedSecretError) {
    throw dashboardApiErrors.apiError('INVALID_REQUEST', error.message);
  }
  throw error;
};

export const listOrgSecretsForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ organizationId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return null;
    }
    const catalog = await getCatalog();
    return listOrganizationSecrets(
      catalog.secretDirectory,
      userId,
      data.organizationId
    );
  });

export const setOrgSecretForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: secretNameSchema,
      organizationId: z.string().min(1),
      value: z.string().min(1),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Unauthorized');
    }
    const catalog = await getCatalog();
    try {
      return await setOrganizationSecret(catalog.secretDirectory, {
        encryptionKey: env.FUNCTHIS_SECRETS_KEY,
        name: data.name,
        organizationId: data.organizationId,
        userId,
        value: data.value,
      });
    } catch (error) {
      rethrowHostedSecretError(error);
    }
  });

export const deleteOrgSecretForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: secretNameSchema,
      organizationId: z.string().min(1),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Unauthorized');
    }
    const catalog = await getCatalog();
    try {
      await deleteOrganizationSecret(catalog.secretDirectory, {
        name: data.name,
        organizationId: data.organizationId,
        userId,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowHostedSecretError(error);
    }
  });

export const setPackageSecretForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      handle: z.string().min(1),
      name: secretNameSchema,
      packageSlug: z.string().min(1),
      value: z.string().min(1),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Unauthorized');
    }
    const ports = await getCatalog();
    const catalog = await getPackageBySlugs(
      ports.catalogRead,
      data.handle,
      data.packageSlug
    );
    if (!catalog) {
      throw dashboardApiErrors.apiError('NOT_FOUND', 'Package not found');
    }
    try {
      return await setPackageSecret(ports.secretDirectory, {
        encryptionKey: env.FUNCTHIS_SECRETS_KEY,
        name: data.name,
        packageRow: catalog,
        userId,
        value: data.value,
      });
    } catch (error) {
      rethrowHostedSecretError(error);
    }
  });

export const deletePackageSecretForSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      handle: z.string().min(1),
      name: secretNameSchema,
      packageSlug: z.string().min(1),
    })
  )
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Unauthorized');
    }
    const ports = await getCatalog();
    const catalog = await getPackageBySlugs(
      ports.catalogRead,
      data.handle,
      data.packageSlug
    );
    if (!catalog) {
      throw dashboardApiErrors.apiError('NOT_FOUND', 'Package not found');
    }
    try {
      await deletePackageSecret(ports.secretDirectory, {
        name: data.name,
        packageRow: catalog,
        userId,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowHostedSecretError(error);
    }
  });
