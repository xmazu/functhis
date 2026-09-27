import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

const OrganizationSettingsLayout = () => <Outlet />;

export const Route = createFileRoute('/d/settings')({
  component: OrganizationSettingsLayout,
  beforeLoad: ({ location }) => {
    if (
      location.pathname === '/d/settings' ||
      location.pathname === '/d/settings/'
    ) {
      throw redirect({ to: '/d/settings/secrets' });
    }
  },
});
