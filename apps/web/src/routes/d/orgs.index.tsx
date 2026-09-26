import { normalizeOrganizationSlug } from '@functhis/publish/org-slug';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
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
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setPageError(null);
    setCreating(true);
    try {
      const { error: createError } = await authClient.organization.create({
        name: name.trim(),
        slug: slug.trim() || normalizeOrganizationSlug(name),
      });
      if (createError) {
        setPageError(createError.message ?? 'Failed to create organization');
        setCreating(false);
        return;
      }
      setName('');
      setSlug('');
      await router.invalidate();
    } catch {
      setPageError('Failed to create organization');
    }
    setCreating(false);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Organizations
        </h1>
      </header>
      <div className="flex flex-col gap-4 p-4">
        <section className="flex max-w-md flex-col gap-2 border p-3">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Create organization
          </h2>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              onChange={(event) => {
                setName(event.target.value);
                if (slug.length === 0) {
                  setSlug(normalizeOrganizationSlug(event.target.value));
                }
              }}
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              onChange={(event) => {
                setSlug(event.target.value);
              }}
              value={slug}
            />
          </div>
          {pageError ? (
            <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
              {pageError}
            </p>
          ) : null}
          <Button
            disabled={creating || name.trim().length === 0}
            onClick={() => {
              void handleCreate();
            }}
            size="sm"
          >
            Create organization
          </Button>
        </section>
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
