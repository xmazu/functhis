import type { ReactElement } from 'react';

import { CopyButton } from '#/routes/d/-components/copy-button';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { formatPackageDate, toPackageIso } from '#/routes/d/-lib/package-dates';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

const ui = packageDetailUiClass;

export const PackageOverviewHeader = ({
  detail,
  packageName,
}: {
  detail: PackageDetailViewModel;
  packageName: string;
}): ReactElement => {
  const functionLabel =
    detail.functions.length === 1
      ? '1 function'
      : `${detail.functions.length} functions`;

  return (
    <header className="mb-8">
      <div className="flex min-w-0 items-center gap-1">
        <h1
          className={`${ui} text-foreground min-w-0 truncate font-mono font-medium`}
          title={packageName}
        >
          {packageName}
        </h1>
        <CopyButton label="Copy package name" value={packageName} />
      </div>
      <p className={`${ui} text-muted-foreground mt-2`}>
        v{detail.semver}
        {' · '}
        <time dateTime={toPackageIso(detail.publishedAt)}>
          {formatPackageDate(detail.publishedAt)}
        </time>
        {' · '}
        {functionLabel}
      </p>
    </header>
  );
};
