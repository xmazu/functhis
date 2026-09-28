import { createFileRoute } from '@tanstack/react-router';

import { fetchDashboardLogs } from '#/routes/d/-server/dashboard-logs-query.server';
import { requireDashboardOrganizationId } from '#/routes/d/-server/resolve-dashboard-organization';
import { createAuth, getDb } from '#/services';

const MAX_PAGE_SIZE = 100;

const json = (body: unknown, init?: ResponseInit): Response =>
  Response.json(body, {
    headers: { 'cache-control': 'no-store' },
    ...init,
  });

const parseDate = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : value;
};

const parseLevels = (value: string | null): string | undefined =>
  value?.trim() ? value : undefined;

export const Route = createFileRoute('/api/d/logs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await createAuth();
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user.id;
        const database = await getDb();
        const organizationId = await requireDashboardOrganizationId(
          request,
          database,
          session
        );

        if (!userId || !organizationId || !session) {
          return json({ error: 'unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const executionId = url.searchParams.get('executionId') ?? undefined;

        const result = await fetchDashboardLogs(
          request,
          userId,
          organizationId,
          {
            cursor: url.searchParams.get('cursor') ?? undefined,
            endTime: parseDate(url.searchParams.get('endTime')),
            executionId,
            level: parseLevels(url.searchParams.get('level')),
            message: url.searchParams.get('message') ?? undefined,
            packageSlug: url.searchParams.get('packageSlug') ?? undefined,
            size: Math.min(
              Math.max(Number(url.searchParams.get('size') ?? 50), 1),
              MAX_PAGE_SIZE
            ),
            sortDirection:
              url.searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc',
            startTime: parseDate(url.searchParams.get('startTime')),
          }
        );

        if (result === 'not_configured') {
          return json({ error: 'logs_not_configured' }, { status: 503 });
        }
        if (result === 'unavailable') {
          return json({ error: 'logs_unavailable' }, { status: 503 });
        }

        return json(result);
      },
    },
  },
});
