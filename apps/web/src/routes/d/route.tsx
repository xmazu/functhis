import { Outlet, createFileRoute } from '@tanstack/react-router';

import { resolveSession } from '#/functions/resolve-session';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/lib/auth/login-redirect';
import { AppShell } from '#/routes/d/-components/app-shell';
import '#/routes/d/-load-surface';

const DLayout = () => (
  <div className="dark flex min-h-svh flex-col" data-surface="dashboard">
    <AppShell>
      <Outlet />
    </AppShell>
  </div>
);

export const Route = createFileRoute('/d')({
  component: DLayout,
  beforeLoad: async ({ location }) => {
    const callbackURL = callbackURLFromLocation(location);
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(callbackURL);
    }
    return { session };
  },
});
