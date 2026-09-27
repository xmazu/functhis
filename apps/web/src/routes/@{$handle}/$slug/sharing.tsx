import { createFileRoute, getRouteApi, redirect } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { authClient } from '#/lib/auth/auth-client';
import { usePackageDetailDashboardQuery } from '#/lib/query/dashboard-cache';
import { PackageConsolePage } from '#/routes/d/-components/package-console-content';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { PackageSharingPanel } from '#/routes/d/-components/package-sharing-panel';
import { showsSharingNav } from '#/routes/d/-components/package-sidebar';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import { getPackageDetailForSession } from '#/routes/d/-server/packages';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');

const PackageSharingPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(loaderDetail, handle, slug);
  const { data: organizations } = authClient.useListOrganizations();

  if (!detail) {
    return <PackageDetailNotFound />;
  }

  const sharingVisibility =
    detail.visibility === 'organization' ? 'organization' : 'private';

  return (
    <PackageConsolePage>
      <PackageSharingPanel
        handle={handle}
        initialOrganizationSlug={detail.organizationSlug ?? ''}
        initialVisibility={sharingVisibility}
        key={`${handle}/${slug}`}
        organizationSlugs={(organizations ?? []).map((org) => org.slug)}
        packageSlug={slug}
      />
    </PackageConsolePage>
  );
};

export const Route = createFileRoute('/@{$handle}/$slug/sharing')({
  component: PackageSharingPage,
  beforeLoad: async ({ params }) => {
    const detail = await getPackageDetailForSession({
      data: { handle: params.handle, slug: params.slug },
    });
    if (!detail || !showsSharingNav(detail)) {
      throw redirect({
        href: packageConsoleHref(params.handle, params.slug),
      });
    }
  },
});
