import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { usePackageDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { PackageConsolePage } from '#/routes/d/-components/package-console-content';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { PackageFunctionsList } from '#/routes/d/-components/package-functions-list';
import { PackageOverviewHeader } from '#/routes/d/-components/package-overview-header';
import { PackageRecentExecutions } from '#/routes/d/-components/package-recent-executions';

const ui = packageDetailUiClass;

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
      <nav
        aria-label="Breadcrumb"
        className={`${ui} text-muted-foreground mb-6 flex min-w-0 items-center gap-2`}
      >
        <Link className="hover:text-foreground shrink-0" to="/d">
          Packages
        </Link>
        <span aria-hidden="true" className="shrink-0">
          /
        </span>
        <Link
          className="hover:text-foreground min-w-0 truncate"
          params={{ handle: detail.handle, slug: detail.packageSlug }}
          to="/@{$handle}/$slug"
        >
          {detail.handle}
        </Link>
        <span aria-hidden="true" className="shrink-0">
          /
        </span>
        <span className="text-foreground min-w-0 truncate">
          {detail.packageSlug}
        </span>
      </nav>

      <PackageOverviewHeader detail={detail} packageName={packageName} />

      <PackageFunctionsList
        functions={detail.functions}
        packageName={packageName}
      />

      {detail.isOwner ? (
        <PackageRecentExecutions executions={detail.executions} />
      ) : null}
    </PackageConsolePage>
  );
};

export const Route = createFileRoute('/@{$handle}/$slug/')({
  component: PackageOverviewPage,
});
