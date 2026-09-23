import { Link, createFileRoute } from '@tanstack/react-router';

import { listPackagesForSession } from '@/server/packages';

const PackagesPage = () => {
  const packages = Route.useLoaderData();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          Packages
        </h1>
      </header>
      <div className="flex flex-col gap-2 p-4">
        {packages.length === 0 ? (
          <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
            No deployed packages yet. Run{' '}
            <code className="font-mono">functhis publish</code> from a project.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {packages.map((pkg) => (
              <li key={pkg.id}>
                <Link
                  className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
                  params={{ handle: pkg.handle, slug: pkg.packageSlug }}
                  to="/packages/$handle/$slug"
                >
                  @{pkg.handle}/{pkg.packageSlug}
                </Link>
                <span className="text-muted-foreground ml-2 text-[length:var(--app-font-size-ui,12px)]">
                  {pkg.functionCount} fn · {pkg.visibility}
                  {pkg.shared ? ' · org' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/packages/')({
  component: PackagesPage,
  loader: () => listPackagesForSession(),
});
