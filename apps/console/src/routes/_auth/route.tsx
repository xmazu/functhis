import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { resolveSession } from '@/functions/resolve-session';
import { redirectToLogin } from '@/lib/login-redirect';

const AuthLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(`${location.pathname}${location.search}`);
    }
    return { session };
  },
});
