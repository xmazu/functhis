import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { usePackageExecutionsDashboardQuery } from '#/lib/query/dashboard-cache';
import { ExecutionList } from '#/routes/d/-components/executions-page';
import { PackageConsoleBreadcrumb } from '#/routes/d/-components/package-console-breadcrumb';
import { PackageConsolePage } from '#/routes/d/-components/package-console-content';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { listExecutionsForSession } from '#/routes/d/-server/executions';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');
const ui = packageDetailUiClass;

const ExecutionsPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const packageDetail = packageRouteApi.useLoaderData();
  const data = usePackageExecutionsDashboardQuery(
    Route.useLoaderData(),
    handle,
    slug
  );

  if (!packageDetail || !data) {
    return <PackageDetailNotFound />;
  }

  return (
    <PackageConsolePage className="pt-6">
      <PackageConsoleBreadcrumb
        handle={data.handle}
        packageSlug={data.packageSlug}
      />
      <h1 className={`${ui} mb-2 text-lg font-medium`}>Executions</h1>
      <p className={`${ui} text-muted-foreground mb-6`}>
        Execution history is retained in Postgres; payloads and logs may expire
        according to Axiom retention.
      </p>
      <ExecutionList
        executions={data.executions}
        handle={data.handle}
        packageSlug={data.packageSlug}
      />
    </PackageConsolePage>
  );
};

export const Route = createFileRoute('/@{$handle}/$slug/executions')({
  component: ExecutionsPage,
  loader: ({ params }) =>
    listExecutionsForSession({
      data: { handle: params.handle, packageSlug: params.slug },
    }),
  pendingComponent: () => (
    <PackageConsolePage className="pt-6">
      <p className={ui}>Loading executions…</p>
    </PackageConsolePage>
  ),
  errorComponent: () => (
    <PackageConsolePage className="pt-6">
      <p className={`${ui} text-destructive`}>
        Unable to load executions. Try again.
      </p>
    </PackageConsolePage>
  ),
});
