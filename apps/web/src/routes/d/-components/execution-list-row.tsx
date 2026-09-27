import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import {
  formatPackageDateTime,
  toPackageIso,
} from '#/routes/d/-lib/package-dates';

const ui = packageDetailUiClass;

export interface ExecutionListRowModel {
  createdAt: Date;
  cpuMs?: number | null;
  functionSlug: string | null;
  id: string;
  status: string;
}

export const ExecutionListRow = ({
  className,
  execution,
  handle,
  packageSlug,
}: {
  className?: string;
  execution: ExecutionListRowModel;
  handle: string;
  packageSlug: string;
}): ReactElement => (
  <Link
    className={
      className ??
      `${ui} text-muted-foreground hover:bg-secondary flex items-center gap-3 py-3`
    }
    params={{ executionId: execution.id, handle, slug: packageSlug }}
    to="/@{$handle}/$slug/executions/$executionId"
  >
    <time dateTime={toPackageIso(execution.createdAt)}>
      {formatPackageDateTime(execution.createdAt)}
    </time>
    <span className="text-foreground min-w-0 truncate font-mono">
      {execution.functionSlug ?? '—'}
    </span>
    <span className="ms-auto">{execution.status}</span>
    {execution.cpuMs === null || execution.cpuMs === undefined ? null : (
      <span className="font-mono tabular-nums">{execution.cpuMs} ms</span>
    )}
  </Link>
);
