import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import {
  getPackageDetailForSession,
  updatePackageSharingForSession,
} from '@/server/packages';

const VISIBILITY_OPTIONS = ['private', 'organization', 'library'] as const;

const PackageDetailPage = () => {
  const { handle, slug } = Route.useParams();
  const detail = Route.useLoaderData();
  const { data: organizations } = authClient.useListOrganizations();
  const [visibility, setVisibility] = useState(detail?.visibility ?? 'private');
  const [organizationSlug, setOrganizationSlug] = useState(
    detail?.organizationSlug ?? ''
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!detail) {
    return (
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <p className="text-[length:var(--app-font-size-ui,12px)]">
          Package not found.
        </p>
        <Link
          className="mt-2 text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/packages"
        >
          Back to packages
        </Link>
      </main>
    );
  }

  const handleSaveSharing = async (): Promise<void> => {
    setSaveError(null);
    setSaved(false);
    try {
      await updatePackageSharingForSession({
        data: {
          handle,
          organizationSlug:
            organizationSlug.trim().length > 0
              ? organizationSlug.trim()
              : undefined,
          packageSlug: slug,
          visibility,
        },
      });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed');
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          @{handle}/{detail.packageSlug}
        </h1>
        <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
          {detail.visibility}
          {detail.isOwner ? '' : ' · shared with you'}
        </p>
      </header>
      <div className="flex flex-col gap-4 p-4">
        {detail.isOwner ? (
          <section className="flex max-w-md flex-col gap-2 border p-3">
            <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
              Sharing
            </h2>
            <div className="flex flex-col gap-1">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                className="bg-input border px-2 py-1 text-[length:var(--app-font-size-ui,12px)]"
                id="visibility"
                onChange={(event) => {
                  setVisibility(
                    event.target.value as (typeof VISIBILITY_OPTIONS)[number]
                  );
                }}
                value={visibility}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="organization">Organization slug</Label>
              <Input
                id="organization"
                onChange={(event) => {
                  setOrganizationSlug(event.target.value);
                }}
                placeholder="Required for organization visibility"
                value={organizationSlug}
              />
              {(organizations ?? []).length > 0 ? (
                <p className="text-muted-foreground text-[11px]">
                  Your orgs:{' '}
                  {(organizations ?? []).map((org) => org.slug).join(', ')}
                </p>
              ) : null}
            </div>
            {saveError ? (
              <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
                {saveError}
              </p>
            ) : null}
            {saved ? (
              <p className="text-[length:var(--app-font-size-ui,12px)]">
                Saved.
              </p>
            ) : null}
            <Button
              onClick={() => {
                void handleSaveSharing();
              }}
              size="sm"
            >
              Save sharing
            </Button>
          </section>
        ) : null}
        <section className="flex flex-col gap-1">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Public URL
          </h2>
          <a
            className="font-mono text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
            href={detail.packageUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {detail.packageUrl}
          </a>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Functions
          </h2>
          {detail.functions.map((fn) => (
            <div className="border p-3" key={fn.slug}>
              <p className="text-[length:var(--app-font-size-ui,12px)] font-medium">
                {fn.slug}
              </p>
              <a
                className="font-mono text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
                href={fn.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {fn.url}
              </a>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed">
                {fn.mcpSnippet}
              </pre>
            </div>
          ))}
        </section>
        {detail.isOwner ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
              Recent executions
            </h2>
            {detail.executions.length === 0 ? (
              <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
                No executions recorded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {detail.executions.map((row) => (
                  <li
                    className="text-[length:var(--app-font-size-ui,12px)]"
                    key={row.id}
                  >
                    {row.createdAt.toISOString()} · {row.functionSlug ?? '—'} ·{' '}
                    {row.status}
                    {row.cpuMs === null ? '' : ` · ${row.cpuMs}ms`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        <Link
          className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/packages"
        >
          Back to packages
        </Link>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/packages/$handle/$slug')({
  component: PackageDetailPage,
  loader: ({ params }) =>
    getPackageDetailForSession({
      data: { handle: params.handle, slug: params.slug },
    }),
});
