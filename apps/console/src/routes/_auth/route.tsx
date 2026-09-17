import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { resolveSession } from '@/functions/resolve-session';

const AuthLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await resolveSession();
    if (!session) {
      throw redirect({
        to: '/login',
      });
    }
    return { session };
  },
});
