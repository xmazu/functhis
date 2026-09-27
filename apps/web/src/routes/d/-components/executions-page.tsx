import type { ReactElement } from 'react';

import { ExecutionListRow } from '#/routes/d/-components/execution-list-row';
import { packageDetailUiClass } from '#/routes/d/-components/package-detail-primitives';
import { formatPackageDateTime } from '#/routes/d/-lib/package-dates';
import type { ExecutionListItem } from '#/routes/d/-server/executions';

const ui = packageDetailUiClass;

export const ExecutionList = ({
  executions,
  handle,
  packageSlug,
}: {
  executions: ExecutionListItem[];
  handle: string;
  packageSlug: string;
}): ReactElement => {
  if (executions.length === 0) {
    return (
      <p className={`${ui} text-muted-foreground`}>
        No executions recorded yet.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {executions.map((row) => (
        <li key={row.id}>
          <ExecutionListRow
            execution={row}
            handle={handle}
            packageSlug={packageSlug}
          />
        </li>
      ))}
    </ul>
  );
};

export const ExecutionDetail = ({
  detail,
}: {
  detail: {
    createdAt: Date;
    cpuMs: number | null;
    functionSlug: string | null;
    payload: {
      input: unknown;
      logs: { level: string; message: string; timestamp: string }[];
      output: unknown;
    } | null;
    payloadState: 'available' | 'expired' | 'missing' | 'unavailable';
    requestBytes: number | null;
    responseBytes: number | null;
    startedAt: Date | null;
    status: string;
  };
}): ReactElement => (
  <div className={`${ui} flex flex-col gap-6`}>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{detail.status}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Function</dt>
        <dd className="truncate font-mono">{detail.functionSlug ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">CPU</dt>
        <dd>{detail.cpuMs === null ? '—' : `${detail.cpuMs} ms`}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Started</dt>
        <dd>
          <time
            dateTime={
              detail.startedAt?.toISOString() ?? detail.createdAt.toISOString()
            }
          >
            {formatPackageDateTime(detail.startedAt ?? detail.createdAt)}
          </time>
        </dd>
      </div>
    </dl>
    <div className="text-muted-foreground">
      {detail.requestBytes ?? 0} request bytes · {detail.responseBytes ?? 0}{' '}
      response bytes
    </div>
    {detail.payloadState === 'unavailable' ? (
      <p className="text-muted-foreground border p-3">
        Input, output, and logs are unavailable because Axiom is not configured
        or could not be reached.
      </p>
    ) : null}
    {detail.payloadState === 'missing' ? (
      <p className="text-muted-foreground border p-3">
        Input, output, and logs are not available yet. They may still be
        ingesting, or telemetry was not recorded for this run.
      </p>
    ) : null}
    {detail.payloadState === 'expired' ? (
      <p className="text-muted-foreground border p-3">
        Input, output, and logs are outside the configured retention window or
        not included on your plan.
      </p>
    ) : null}
    {detail.payload ? (
      <>
        <section>
          <h2 className="mb-2 font-medium">Input</h2>
          <pre className="overflow-x-auto border p-3">
            {JSON.stringify(detail.payload.input, null, 2)}
          </pre>
        </section>
        <section>
          <h2 className="mb-2 font-medium">Output</h2>
          <pre className="overflow-x-auto border p-3">
            {JSON.stringify(detail.payload.output, null, 2)}
          </pre>
        </section>
        <section>
          <h2 className="mb-2 font-medium">Logs</h2>
          {detail.payload.logs.length === 0 ? (
            <p className="text-muted-foreground">No logs recorded.</p>
          ) : (
            <ul className="divide-border divide-y border">
              {detail.payload.logs.map((log, index) => (
                <li className="p-2" key={`${log.timestamp}-${index}`}>
                  <span className="text-muted-foreground me-2">
                    {log.level}
                  </span>
                  {log.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    ) : null}
  </div>
);
