import { Outlet, createFileRoute } from '@tanstack/react-router';

import { resolveSession } from '#/functions/resolve-session';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/modules/auth/lib/login-redirect';
import { AppShell } from '#/modules/d/components/app-shell';

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
