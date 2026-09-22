import { createFileRoute } from '@tanstack/react-router';

import { Homepage } from '#/components/marketing/homepage';

export const Route = createFileRoute('/')({
  component: Homepage,
});
