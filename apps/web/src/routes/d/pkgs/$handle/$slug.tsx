import { createFileRoute, redirect } from '@tanstack/react-router';

import { packageConsoleHref } from '#/routes/d/-lib/package-console-href';

export const Route = createFileRoute('/d/pkgs/$handle/$slug')({
  beforeLoad: ({ params }) => {
    throw redirect({
      href: packageConsoleHref(params.handle, params.slug),
    });
  },
});
