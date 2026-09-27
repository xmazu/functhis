import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/d/pkgs/')({
  beforeLoad: () => {
    throw redirect({ to: '/d' });
  },
});
