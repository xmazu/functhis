import { getRouteApi, useParams, useRouterState } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { usePackageDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { cn } from '#/lib/utils';
import { CopyButton } from '#/routes/d/-components/copy-button';
import { packageConsoleWidthClassName } from '#/routes/d/-components/package-console-content';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import { packageConsoleRouteId } from '#/routes/d/-lib/package-console-path';

const ui = packageDetailUiClass;
const packageRouteApi = getRouteApi(packageConsoleRouteId);

export const PackageConsoleHeader = (): ReactElement | null => {
  const { handle, slug } = useParams({ strict: false });
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(
    loaderDetail,
    handle ?? '',
    slug ?? ''
  );

  if (!detail) {
    return null;
  }

  const packageName = `@${detail.handle}/${detail.packageSlug}`;
  const overviewPath = packageConsoleHref(detail.handle, detail.packageSlug);
  const isOverview =
    pathname === overviewPath || pathname === `${overviewPath}/`;

  if (isOverview) {
    return null;
  }

  return (
    <header className={cn(packageConsoleWidthClassName, 'shrink-0 pt-6 pb-5')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1">
          <h1
            className={`${ui} min-w-0 truncate font-mono font-medium`}
            title={packageName}
          >
            {packageName}
          </h1>
          <CopyButton label="Copy package name" value={packageName} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <p className={`${ui} font-mono`}>{detail.semver}</p>
          {detail.isOwner ? null : (
            <p className={`${ui} text-muted-foreground`}>Shared with you</p>
          )}
        </div>
      </div>
    </header>
  );
};
