import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/accept-invitation/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { id: params.id },
      to: '/d/accept-invitation/$id',
    });
  },
});
