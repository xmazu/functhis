import { createDb } from '@functhis/db';
import { isMemberOfOrganization } from '@functhis/publish';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { env } from '#/env.server';
import { dashboardApiErrors } from '#/lib/errors/dashboard';
import { authMiddleware } from '#/middleware/auth';
import {
  aggregateExecutionAnalyticsPeriod,
  buildExecutionAnalyticsSql,
  emptyExecutionAnalyticsPeriod,
} from '#/routes/d/-server/org-usage-analytics';

const organizationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);

interface AnalyticsResponse {
  data?: {
    duration_total?: number | string;
    executions?: number | string;
    function_slug?: string;
    status?: string;
  }[];
  errors?: unknown[];
  success?: boolean;
}

const queryPeriod = async (
  organizationId: string,
  hours: number
): Promise<ReturnType<typeof emptyExecutionAnalyticsPeriod>> => {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.ANALYTICS_ENGINE_READ_TOKEN) {
    return emptyExecutionAnalyticsPeriod();
  }

  const query = buildExecutionAnalyticsSql(organizationId, hours);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      body: query,
      headers: {
        Authorization: `Bearer ${env.ANALYTICS_ENGINE_READ_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      method: 'POST',
    }
  );
  if (!response.ok) {
    throw dashboardApiErrors.apiError(
      'INTERNAL_ERROR',
      `Analytics Engine query failed (${response.status})`
    );
  }

  const result = (await response.json()) as AnalyticsResponse;
  if (!result.success || result.errors?.length || !result.data) {
    throw dashboardApiErrors.apiError(
      'INTERNAL_ERROR',
      'Analytics Engine returned an invalid response'
    );
  }

  return aggregateExecutionAnalyticsPeriod(result.data);
};

export const getOrgUsageForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ organizationId: organizationIdSchema }))
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return null;
    }
    const database = await createDb(env);
    if (
      !(await isMemberOfOrganization(database, userId, data.organizationId))
    ) {
      return null;
    }
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.ANALYTICS_ENGINE_READ_TOKEN) {
      return {
        available: false,
        periods: {
          day: emptyExecutionAnalyticsPeriod(),
          month: emptyExecutionAnalyticsPeriod(),
          week: emptyExecutionAnalyticsPeriod(),
        },
      };
    }

    const [day, week, month] = await Promise.all([
      queryPeriod(data.organizationId, 24),
      queryPeriod(data.organizationId, 24 * 7),
      queryPeriod(data.organizationId, 24 * 30),
    ]);
    return { available: true, periods: { day, month, week } };
  });
