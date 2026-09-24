import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { resolveSession } from '@/functions/resolve-session';
import { callbackURLFromLocation, redirectToLogin } from '@/lib/login-redirect';

const AuthLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const callbackURL = callbackURLFromLocation(location);
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(callbackURL);
    }
    return { session };
  },
});
