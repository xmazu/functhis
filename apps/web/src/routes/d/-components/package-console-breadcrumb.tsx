import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';

const ui = packageDetailUiClass;

export const PackageConsoleBreadcrumb = ({
  handle,
  packageSlug,
}: {
  handle: string;
  packageSlug: string;
}): ReactElement => {
  const packageParams = { handle, slug: packageSlug };

  return (
    <nav
      aria-label="Breadcrumb"
      className={`${ui} text-muted-foreground mb-6 flex min-w-0 items-center gap-2`}
    >
      <Link
        className="hover:text-foreground min-w-0 truncate"
        params={packageParams}
        to="/@{$handle}/$slug"
      >
        {handle}
      </Link>
      <span aria-hidden="true" className="shrink-0">
        /
      </span>
      <span className="text-foreground min-w-0 truncate">{packageSlug}</span>
    </nav>
  );
};
