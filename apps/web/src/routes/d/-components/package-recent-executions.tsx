import type { ReactElement } from 'react';

import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import {
  formatPackageDateTime,
  toPackageIso,
} from '#/routes/d/-lib/package-dates';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

const ui = packageDetailUiClass;

const sectionLabelClass = `${ui} mb-4 flex items-center gap-2 border-b border-border pb-4 font-mono text-foreground`;

export const PackageRecentExecutions = ({
  executions,
}: {
  executions: PackageDetailViewModel['executions'];
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
            <time dateTime={toPackageIso(row.createdAt)}>
              {formatPackageDateTime(row.createdAt)}
            </time>
            <span className="text-foreground ms-2 font-mono">
              {row.functionSlug ?? '—'}
            </span>
            <span className="ms-2">{row.status}</span>
            {row.cpuMs === null ? null : (
              <span className="ms-2 font-mono tabular-nums">
                {row.cpuMs} ms
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
