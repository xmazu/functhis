import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { resolveSession } from '@/functions/resolve-session';

const AuthLayout = () => <Outlet />;

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
