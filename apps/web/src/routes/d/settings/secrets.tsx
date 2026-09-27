import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth/auth-client';
import { patchOrgSecrets } from '#/lib/query/dashboard-cache';
import type { OrgSecretsQueryData } from '#/lib/query/dashboard-cache';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import { SecretsSettingsPanel } from '#/routes/d/-components/secrets-settings-panel';
import {
  SettingsPage,
  settingsText,
} from '#/routes/d/-components/settings/settings-primitives';
import {
  deleteOrgSecretForSession,
  listOrgSecretsForSession,
  setOrgSecretForSession,
} from '#/routes/d/-server/secrets';

const dRouteApi = getRouteApi('/d');

const SettingsSecretsPage = () => {
  const { activeOrganizationId } = dRouteApi.useLoaderData();
  const { data: organizations } = authClient.useListOrganizations();
  const organizationId = activeOrganizationId ?? organizations?.[0]?.id ?? '';
  const queryClient = useAppQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const secretsKey = dashboardKeys.orgSecrets(organizationId);
  const secretsQuery = useQuery({
    enabled: organizationId.length > 0,
    queryFn: () => listOrgSecretsForSession({ data: { organizationId } }),
    queryKey: secretsKey,
  });
  const secretsView = secretsQuery.data ?? null;

  if (!organizationId) {
    return (
      <SettingsPage
        contentClassName="max-w-3xl"
        description="Store values that your deployed functions can read at runtime."
        title="Secrets"
      >
        <p className={`${settingsText} text-muted-foreground`}>
          Select an organization to manage secrets.
        </p>
      </SettingsPage>
    );
  }

  if (secretsQuery.isPending) {
    return (
      <SettingsPage
        contentClassName="max-w-3xl"
        description="Store values that your deployed functions can read at runtime."
        title="Secrets"
      >
        <p className={`${settingsText} text-muted-foreground`}>
          Loading organization secrets…
        </p>
      </SettingsPage>
    );
  }

  if (!secretsView) {
    return (
      <SettingsPage
        contentClassName="max-w-3xl"
        description="Store values that your deployed functions can read at runtime."
        title="Secrets"
      >
        <p className={`${settingsText} text-muted-foreground`}>
          You do not have access to secrets for this organization.
        </p>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      action={
        secretsView.canWrite ? (
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
      description="Store values that your deployed functions can read at runtime."
      title="Secrets"
    >
      <SecretsSettingsPanel
        canWrite={secretsView.canWrite}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        onDelete={async (name) => {
          await runOptimistic(
            queryClient,
            [
              {
                queryKey: secretsKey,
                updater: (previous) => {
                  if (!previous || typeof previous !== 'object') {
                    return previous;
                  }
                  return patchOrgSecrets(
                    previous as OrgSecretsQueryData,
                    name,
                    'delete'
                  );
                },
              },
            ],
            async () => {
              await deleteOrgSecretForSession({
                data: { name, organizationId },
              });
              const next = await listOrgSecretsForSession({
                data: { organizationId },
              });
              if (next) {
                queryClient.setQueryData(secretsKey, next);
              }
            },
            { invalidateOnSuccess: false }
          );
        }}
        onSet={async (name, value) => {
          await runOptimistic(
            queryClient,
            [
              {
                queryKey: secretsKey,
                updater: (previous) => {
                  if (!previous || typeof previous !== 'object') {
                    return previous;
                  }
                  return patchOrgSecrets(
                    previous as OrgSecretsQueryData,
                    name,
                    'set'
                  );
                },
              },
            ],
            async () => {
              await setOrgSecretForSession({
                data: { name, organizationId, value },
              });
              const next = await listOrgSecretsForSession({
                data: { organizationId },
              });
              if (next) {
                queryClient.setQueryData(secretsKey, next);
              }
            },
            { invalidateOnSuccess: false }
          );
        }}
        secrets={secretsView.secrets}
      />
    </SettingsPage>
  );
};

export const Route = createFileRoute('/d/settings/secrets')({
  component: SettingsSecretsPage,
});
