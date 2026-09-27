import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';

const ui = packageDetailUiClass;

export const PackageDetailNotFound = (): ReactElement => (
  <main className="flex min-h-0 flex-1 flex-col p-4">
    <p className={ui}>Package not found.</p>
    <Link className={`${ui} mt-2 underline-offset-2 hover:underline`} to="/d">
      Back to packages
    </Link>
  </main>
);
