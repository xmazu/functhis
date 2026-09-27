import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { usePackageDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { PackageConsoleBreadcrumb } from '#/routes/d/-components/package-console-breadcrumb';
import { PackageConsolePage } from '#/routes/d/-components/package-console-content';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { PackageFunctionsList } from '#/routes/d/-components/package-functions-list';
import { PackageOverviewHeader } from '#/routes/d/-components/package-overview-header';
import { PackageRecentExecutions } from '#/routes/d/-components/package-recent-executions';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');

const PackageOverviewPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(loaderDetail, handle, slug);

  if (!detail) {
    return <PackageDetailNotFound />;
  }

  const packageName = `@${detail.handle}/${detail.packageSlug}`;

  return (
    <PackageConsolePage className="pt-6">
      <PackageConsoleBreadcrumb
        handle={detail.handle}
        packageSlug={detail.packageSlug}
      />

      <PackageOverviewHeader detail={detail} packageName={packageName} />

      <PackageFunctionsList functions={detail.functions} />

      {detail.isOwner ? (
        <PackageRecentExecutions
          executions={detail.executions}
          handle={detail.handle}
          packageSlug={detail.packageSlug}
        />
      ) : null}
    </PackageConsolePage>
  );
};

export const Route = createFileRoute('/@{$handle}/$slug/')({
  component: PackageOverviewPage,
});
