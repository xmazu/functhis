import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/d/setup/workspace')({
  beforeLoad: () => {
    throw redirect({ to: '/d/onboard' });
  },
});
