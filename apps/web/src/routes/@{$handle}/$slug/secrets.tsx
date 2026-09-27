import {
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import type { ReactElement } from 'react';

import {
  patchPackageSecrets,
  usePackageDetailDashboardQuery,
} from '#/lib/query/dashboard-cache';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { SecretsPanel } from '#/routes/d/-components/secrets-panel';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';
import { getPackageDetailForSession } from '#/routes/d/-server/packages';
import {
  deletePackageSecretForSession,
  setPackageSecretForSession,
} from '#/routes/d/-server/secrets';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');

const PackageSecretsPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(loaderDetail, handle, slug);
  const router = useRouter();
  const queryClient = useAppQueryClient();
  const detailKey = dashboardKeys.packageDetail(handle, slug);

  if (!detail) {
    return <PackageDetailNotFound />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6">
      <SecretsPanel
        canWrite={detail.canWriteSecrets}
        heading="Secrets"
        missingNames={detail.missingSecretNames}
        onDelete={async (name) => {
          await runOptimistic(
            queryClient,
            [
              {
                queryKey: detailKey,
                updater: (previous) => {
                  if (!previous || typeof previous !== 'object') {
                    return previous;
                  }
                  return patchPackageSecrets(
                    previous as PackageDetailViewModel,
                    name,
                    'delete'
                  );
                },
              },
            ],
            async () => {
              await deletePackageSecretForSession({
                data: { handle, name, packageSlug: slug },
              });
              await router.invalidate();
            },
            { invalidateOnSuccess: false }
          );
        }}
        onSet={async (name, value) => {
          await runOptimistic(
            queryClient,
            [
              {
                queryKey: detailKey,
                updater: (previous) => {
                  if (!previous || typeof previous !== 'object') {
                    return previous;
                  }
                  return patchPackageSecrets(
                    previous as PackageDetailViewModel,
                    name,
                    'set'
                  );
                },
              },
            ],
            async () => {
              await setPackageSecretForSession({
                data: { handle, name, packageSlug: slug, value },
              });
              await router.invalidate();
            },
            { invalidateOnSuccess: false }
          );
        }}
        secrets={detail.secrets}
      />
    </main>
  );
};

export const Route = createFileRoute('/@{$handle}/$slug/secrets')({
  component: PackageSecretsPage,
  beforeLoad: async ({ params }) => {
    const detail = await getPackageDetailForSession({
      data: { handle: params.handle, slug: params.slug },
    });
    if (!detail?.canWriteSecrets) {
      throw redirect({
        href: packageConsoleHref(params.handle, params.slug),
      });
    }
  },
});
