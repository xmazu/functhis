import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { ExecutionListRow } from '#/routes/d/-components/execution-list-row';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

const ui = packageDetailUiClass;

const sectionLabelClass = `${ui} mb-4 flex items-center gap-2 border-b border-border pb-4 font-mono text-foreground`;

export const PackageRecentExecutions = ({
  executions,
  handle,
  packageSlug,
}: {
  executions: PackageDetailViewModel['executions'];
  handle: string;
  packageSlug: string;
}): ReactElement => (
  <section className="mt-12 scroll-mt-10" id="recent-executions">
    <div className={sectionLabelClass}>recent executions</div>
    {executions.length === 0 ? (
      <p className={`${ui} text-muted-foreground`}>
        No executions recorded yet.
      </p>
    ) : (
      <ul className="divide-border divide-y">
        {executions.map((row) => (
          <li className={`${ui} text-muted-foreground py-2`} key={row.id}>
            <ExecutionListRow
              className={`${ui} text-muted-foreground hover:text-foreground flex flex-wrap items-center gap-x-2 gap-y-1`}
              execution={row}
              handle={handle}
              packageSlug={packageSlug}
            />
          </li>
        ))}
      </ul>
    )}
    <Link
      className={`${ui} text-muted-foreground hover:text-foreground mt-4 inline-block`}
      params={{ handle, slug: packageSlug }}
      to="/@{$handle}/$slug/executions"
    >
      View all executions →
    </Link>
  </section>
);
