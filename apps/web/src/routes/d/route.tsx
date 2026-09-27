import {
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router';

import { AuthCanvas } from '#/lib/auth/auth-canvas';
import { AppShell } from '#/routes/d/-components/app-shell';
import { isDashboardBootstrapPath } from '#/routes/d/-lib/dashboard-bootstrap-path';
import { dashboardConsoleBeforeLoad } from '#/routes/d/-lib/dashboard-console-before-load';
import '#/routes/d/-load-surface';
import { listOrganizationsForSession } from '#/routes/d/-server/organizations';

const DLayout = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const bootstrap = isDashboardBootstrapPath(pathname);

  return (
    <div className="dark flex min-h-svh flex-col" data-surface="dashboard">
      {bootstrap ? (
        <AuthCanvas>
          <Outlet />
        </AuthCanvas>
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </div>
  );
};

export const Route = createFileRoute('/d')({
  component: DLayout,
  loader: () => listOrganizationsForSession(),
  beforeLoad: dashboardConsoleBeforeLoad,
});
