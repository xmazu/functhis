import { normalizeOrganizationSlug } from '@functhis/publish/org-slug';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { authClient } from '#/lib/auth/auth-client';
import { Button } from '#/routes/d/-components/ui/button';
import { Input } from '#/routes/d/-components/ui/input';
import { Label } from '#/routes/d/-components/ui/label';

const OrganizationsPage = () => {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setError(null);
    setCreating(true);
    try {
      const { error: createError } = await authClient.organization.create({
        name: name.trim(),
        slug: slug.trim() || normalizeOrganizationSlug(name),
      });
      if (createError) {
        setError(createError.message ?? 'Failed to create organization');
        setCreating(false);
        return;
      }
      setName('');
      setSlug('');
      await authClient.organization.list();
    } catch {
      setError('Failed to create organization');
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
          {error ? (
            <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
              {error}
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
          {(organizations ?? []).length === 0 ? (
            <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
              No organizations yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(organizations ?? []).map((org) => (
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
                  {activeOrganization?.id === org.id ? (
                    <span className="text-muted-foreground">· active</span>
                  ) : (
                    <Button
                      onClick={() => {
                        void authClient.organization.setActive({
                          organizationId: org.id,
                        });
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
});
