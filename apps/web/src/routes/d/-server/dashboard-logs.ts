import { createServerFn } from '@tanstack/react-start';
import { getStartContext } from '@tanstack/start-storage-context';
import { z } from 'zod';

import { dashboardApiErrors } from '#/lib/errors/dashboard';
import { authMiddleware } from '#/middleware/auth';
import { requireDashboardOrganizationId } from '#/routes/d/-server/resolve-dashboard-organization';
import { getDb } from '#/services';

const MAX_PAGE_SIZE = 100;

const listInputSchema = z.object({
  cursor: z.string().optional(),
  endTime: z.string().optional(),
  level: z.string().optional(),
  message: z.string().optional(),
  packageSlug: z.string().optional(),
  size: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  startTime: z.string().optional(),
});

const getRequest = (): Request => {
  const request = getStartContext({ throwIfNotFound: false })?.request;
  if (!request) {
    throw dashboardApiErrors.apiError('UNAUTHORIZED', 'Sign in to view logs.');
  }
  return request;
};

export const listDashboardLogsForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(listInputSchema)
  .handler(async ({ context, data }) => {
    const { fetchDashboardLogs } =
      await import('#/routes/d/-server/dashboard-logs-query.server');
    const request = getRequest();
    const database = await getDb();
    const organizationId = await requireDashboardOrganizationId(
      request,
      database,
      context.session
    );
    const userId = context.session?.user?.id;
    if (!userId || !organizationId) {
      throw dashboardApiErrors.apiError(
        'UNAUTHORIZED',
        'Sign in or select an organization to view logs.'
      );
    }

    const result = await fetchDashboardLogs(
      request,
      userId,
      organizationId,
      data
    );
    if (result === 'not_configured') {
      throw dashboardApiErrors.apiError(
        'INTERNAL_ERROR',
        'Logs are not configured. Set AXIOM_API_TOKEN and AXIOM_DATASET in apps/web/.env, then restart dev.'
      );
    }
    if (result === 'unavailable') {
      throw dashboardApiErrors.apiError(
        'INTERNAL_ERROR',
        'Logs are temporarily unavailable. Check the web worker terminal for Axiom query errors.'
      );
    }
    if ('execution' in result) {
      throw dashboardApiErrors.apiError(
        'INVALID_REQUEST',
        'Invalid logs query.'
      );
    }
    return result;
  });

const executionInputSchema = z.object({
  executionId: z.string().min(1).max(256),
});

export const getDashboardLogExecutionForSession = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .validator(executionInputSchema)
  .handler(async ({ context, data }) => {
    const { fetchDashboardLogs } =
      await import('#/routes/d/-server/dashboard-logs-query.server');
    const request = getRequest();
    const database = await getDb();
    const organizationId = await requireDashboardOrganizationId(
      request,
      database,
      context.session
    );
    const userId = context.session?.user?.id;
    if (!userId || !organizationId) {
      throw dashboardApiErrors.apiError(
        'UNAUTHORIZED',
        'Sign in or select an organization to view logs.'
      );
    }

    const result = await fetchDashboardLogs(request, userId, organizationId, {
      executionId: data.executionId,
    });
    if (result === 'not_configured') {
      throw dashboardApiErrors.apiError(
        'INTERNAL_ERROR',
        'Logs are not configured. Set AXIOM_API_TOKEN and AXIOM_DATASET in apps/web/.env, then restart dev.'
      );
    }
    if (result === 'unavailable') {
      throw dashboardApiErrors.apiError(
        'INTERNAL_ERROR',
        'Logs are temporarily unavailable. Check the web worker terminal for Axiom query errors.'
      );
    }
    if (!('execution' in result)) {
      throw dashboardApiErrors.apiError(
        'INVALID_REQUEST',
        'Invalid logs query.'
      );
    }
    return result;
  });
