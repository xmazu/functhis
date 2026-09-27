import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { useExecutionDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { ExecutionDetail } from '#/routes/d/-components/executions-page';
import { PackageConsoleBreadcrumb } from '#/routes/d/-components/package-console-breadcrumb';
import { PackageConsolePage } from '#/routes/d/-components/package-console-content';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { getExecutionForSession } from '#/routes/d/-server/executions';

const ui = packageDetailUiClass;

const ExecutionDetailPage = (): ReactElement => {
  const { executionId, handle, slug } = Route.useParams();
  const detail = useExecutionDetailDashboardQuery(
    Route.useLoaderData(),
    handle,
    slug,
    executionId
  );

  if (!detail) {
    return <PackageDetailNotFound />;
  }

  return (
    <PackageConsolePage className="pt-6">
      <PackageConsoleBreadcrumb handle={handle} packageSlug={slug} />
      <h1 className={`${ui} mb-1 text-lg font-medium`}>Execution detail</h1>
      <p className={`${ui} text-muted-foreground mb-6 font-mono`}>
        {detail.id}
      </p>
      <ExecutionDetail detail={detail} />
    </PackageConsolePage>
  );
};

export const Route = createFileRoute(
  '/@{$handle}/$slug/executions/$executionId'
)({
  component: ExecutionDetailPage,
  loader: ({ params }) =>
    getExecutionForSession({
      data: {
        executionId: params.executionId,
        handle: params.handle,
        packageSlug: params.slug,
      },
    }),
  pendingComponent: () => (
    <PackageConsolePage className="pt-6">
      <p className={ui}>Loading execution…</p>
    </PackageConsolePage>
  ),
  errorComponent: () => (
    <PackageConsolePage className="pt-6">
      <p className={`${ui} text-destructive`}>
        Unable to load this execution. Try again.
      </p>
    </PackageConsolePage>
  ),
});
