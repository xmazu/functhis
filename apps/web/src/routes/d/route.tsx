import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router';

import { userHasOrganization } from '#/functions/has-organization';
import { resolveSession } from '#/functions/resolve-session';
import { AuthCanvas } from '#/lib/auth/auth-canvas';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/lib/auth/login-redirect';
import { AppShell } from '#/routes/d/-components/app-shell';
import { isDashboardBootstrapPath } from '#/routes/d/-lib/dashboard-bootstrap-path';
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
  beforeLoad: async ({ location }) => {
    const callbackURL = callbackURLFromLocation(location);
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(callbackURL);
    }

    const bootstrap = isDashboardBootstrapPath(location.pathname);
    const acceptInvitationOnly =
      bootstrap && location.pathname.startsWith('/d/accept-invitation/');

    if (acceptInvitationOnly) {
      return { session };
    }

    const hasOrg = await userHasOrganization();

    if (!hasOrg && !bootstrap) {
      throw redirect({ to: '/d/onboard' });
    }

    if (hasOrg && bootstrap) {
      throw redirect({ to: '/d' });
    }

    return { session };
  },
});
