import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '#/components/ui/button';
import { authClient } from '#/lib/auth/auth-client';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { useOrganizationsDashboardQuery } from '#/lib/query/dashboard-cache';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { runOptimistic } from '#/lib/query/optimistic';
import { useAppQueryClient } from '#/lib/query/use-app-query-client';
import { listOrganizationsForSession } from '#/routes/d/-server/organizations';

const OrganizationsPage = () => {
  const router = useRouter();
  const queryClient = useAppQueryClient();
  const loaderData = Route.useLoaderData();
  const { activeOrganizationId, organizations } =
    useOrganizationsDashboardQuery(loaderData);
  const [pageError, setPageError] = useState<string | null>(null);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Organizations
        </h1>
      </header>
      <div className="flex flex-col gap-4 p-4">
        {pageError ? (
          <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
            {pageError}
          </p>
        ) : null}
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Your organizations
          </h2>
          {organizations.length === 0 ? (
            <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
              No organizations yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {organizations.map((org) => (
                <li
                  className="flex items-center gap-2 text-[length:var(--app-font-size-ui,12px)]"
                  key={org.id}
                >
                  <Link
                    className="underline-offset-2 hover:underline"
                    params={{ slug: org.slug }}
                    to="/d/orgs/$slug"
                  >
                    {org.name}
                  </Link>
                  <span className="text-muted-foreground font-mono">
                    {org.slug}
                  </span>
                  {activeOrganizationId === org.id ? (
                    <span className="text-muted-foreground">· active</span>
                  ) : (
                    <Button
                      onClick={() => {
                        void (async () => {
                          try {
                            await runOptimistic(
                              queryClient,
                              [
                                {
                                  queryKey: dashboardKeys.organizations(),
                                  updater: (previous) => {
                                    if (
                                      !previous ||
                                      typeof previous !== 'object'
                                    ) {
                                      return previous;
                                    }
                                    return {
                                      ...previous,
                                      activeOrganizationId: org.id,
                                    };
                                  },
                                },
                              ],
                              async () => {
                                await authClient.organization.setActive({
                                  organizationId: org.id,
                                });
                                await router.invalidate();
                              },
                              { invalidateOnSuccess: false }
                            );
                          } catch (error) {
                            setPageError(messageFromUnknown(error));
                          }
                        })();
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Set active
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/d/orgs/')({
  component: OrganizationsPage,
  loader: () => listOrganizationsForSession(),
});
