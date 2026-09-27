import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppShell } from '#/routes/d/-components/app-shell';
import { dashboardConsoleBeforeLoad } from '#/routes/d/-lib/dashboard-console-before-load';
import '#/routes/d/-load-surface';
import { getPackageDetailForSession } from '#/routes/d/-server/packages';

const PackageConsoleLayout = () => (
  <div className="dark flex min-h-svh flex-col" data-surface="dashboard">
    <AppShell>
      <Outlet />
    </AppShell>
  </div>
);

export const Route = createFileRoute('/@{$handle}/$slug')({
  component: PackageConsoleLayout,
  beforeLoad: dashboardConsoleBeforeLoad,
  loader: ({ params }) =>
    getPackageDetailForSession({
      data: { handle: params.handle, slug: params.slug },
    }),
});
