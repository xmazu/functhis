import { createFileRoute } from '@tanstack/react-router';

import { cn } from '#/lib/utils';
import { packageConsoleContentClassName } from '#/routes/d/-components/package-console-content';
import { PackageList } from '#/routes/d/-components/package-list';
import { listPackagesForSession } from '#/routes/d/-server/packages';

const PackagesPage = () => {
  const packages = Route.useLoaderData();

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className={cn(packageConsoleContentClassName, 'pt-6')}>
        <h1 className="sr-only">Packages</h1>
        <PackageList packages={packages} />
      </div>
    </main>
  );
};

export const Route = createFileRoute('/d/')({
  component: PackagesPage,
  loader: () => listPackagesForSession(),
});
