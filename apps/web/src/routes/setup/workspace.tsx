import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/setup/workspace')({
  beforeLoad: () => {
    throw redirect({ to: '/d/setup/workspace' });
  },
});
