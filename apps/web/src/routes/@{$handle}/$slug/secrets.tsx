import { IconPlus } from '@tabler/icons-react';
import {
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import {
  patchPackageSecrets,
  usePackageDetailDashboardQuery,
} from '#/lib/query/dashboard-cache';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import { PackageConsoleBreadcrumb } from '#/routes/d/-components/package-console-breadcrumb';
import { PackageDetailNotFound } from '#/routes/d/-components/package-detail-not-found';
import { SecretsSettingsPanel } from '#/routes/d/-components/secrets-settings-panel';
import { SettingsPage } from '#/routes/d/-components/settings/settings-primitives';
import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';
import { getPackageDetailForSession } from '#/routes/d/-server/packages';
import {
  deletePackageSecretForSession,
  setPackageSecretForSession,
} from '#/routes/d/-server/secrets';

const packageRouteApi = getRouteApi('/@{$handle}/$slug');

const SECRETS_DESCRIPTION =
  'Store values that your deployed functions can read at runtime.';

const PackageSecretsPage = (): ReactElement => {
  const { handle, slug } = Route.useParams();
  const loaderDetail = packageRouteApi.useLoaderData();
  const detail = usePackageDetailDashboardQuery(loaderDetail, handle, slug);
  const router = useRouter();
  const queryClient = useAppQueryClient();
  const detailKey = dashboardKeys.packageDetail(handle, slug);
  const [createOpen, setCreateOpen] = useState(false);

  if (!detail) {
    return <PackageDetailNotFound />;
  }

  return (
    <SettingsPage
      action={
        detail.canWriteSecrets ? (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
            size="sm"
          >
            <IconPlus />
            New secret
          </Button>
        ) : null
      }
      contentClassName="max-w-3xl"
      description={SECRETS_DESCRIPTION}
      leading={
        <PackageConsoleBreadcrumb
          handle={detail.handle}
          packageSlug={detail.packageSlug}
        />
      }
      title="Secrets"
    >
      <SecretsSettingsPanel
        canWrite={detail.canWriteSecrets}
        createOpen={createOpen}
        missingNames={detail.missingSecretNames}
        onCreateOpenChange={setCreateOpen}
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
    </SettingsPage>
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
