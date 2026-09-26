import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect } from 'react';

import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

export interface OrganizationsQueryData {
  activeOrganizationId: string | null;
  organizations: {
    id: string;
    name: string;
    slug: string;
  }[];
}

export interface OrgSecretsQueryData {
  canWrite: boolean;
  secrets: { name: string; updatedAt: Date | string }[];
}

export const useOrganizationsDashboardQuery = (
  loaderData: OrganizationsQueryData
): OrganizationsQueryData => {
  const queryClient = useAppQueryClient();
  const queryKey = dashboardKeys.organizations();

  useLayoutEffect(() => {
    queryClient.setQueryData(dashboardKeys.organizations(), loaderData);
  }, [loaderData, queryClient]);

  const query = useQuery({
    initialData: loaderData,
    queryFn: () => loaderData,
    queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? loaderData;
};

export const usePackageDetailDashboardQuery = (
  loaderData: PackageDetailViewModel | null,
  handle: string,
  packageSlug: string
): PackageDetailViewModel | null => {
  const queryClient = useAppQueryClient();
  const queryKey = dashboardKeys.packageDetail(handle, packageSlug);

  useLayoutEffect(() => {
    if (loaderData) {
      queryClient.setQueryData(
        dashboardKeys.packageDetail(handle, packageSlug),
        loaderData
      );
    }
  }, [handle, loaderData, packageSlug, queryClient]);

  const query = useQuery({
    enabled: loaderData !== null,
    initialData: loaderData ?? undefined,
    queryFn: () => loaderData,
    queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? loaderData;
};

export const useOrgSecretsDashboardQuery = (
  organizationId: string,
  loaderData: OrgSecretsQueryData | null
): OrgSecretsQueryData | null => {
  const queryClient = useAppQueryClient();
  const queryKey = dashboardKeys.orgSecrets(organizationId);

  useLayoutEffect(() => {
    if (loaderData) {
      queryClient.setQueryData(
        dashboardKeys.orgSecrets(organizationId),
        loaderData
      );
    }
  }, [loaderData, organizationId, queryClient]);

  const query = useQuery({
    enabled: loaderData !== null,
    initialData: loaderData ?? undefined,
    queryFn: () => loaderData,
    queryKey,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? loaderData;
};
