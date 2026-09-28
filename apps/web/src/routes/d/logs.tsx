import { IconRefresh } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { cn } from '#/lib/utils';
import { LogDetailsSheet } from '#/routes/d/-components/log-details-sheet';
import { LogsFilterCommand } from '#/routes/d/-components/logs-filter-command';
import type { LogsFilterValues } from '#/routes/d/-lib/logs-filter-parser';
import {
  getDashboardLogExecutionForSession,
  listDashboardLogsForSession,
} from '#/routes/d/-server/dashboard-logs';

interface LogRow {
  executionId: string;
  functionSlug: string;
  handle: string;
  level: string;
  message: string;
  packageSlug: string;
  timestamp: string;
  versionId: string;
}

interface ExecutionPayload {
  input: string | null;
  output: string | null;
  status: string | null;
}

const levelClassName = (level: string): string => {
  if (level === 'error') {
    return 'text-destructive';
  }
  if (level === 'warn' || level === 'warning') {
    return 'text-warning';
  }
  return 'text-muted-foreground';
};

const LogsPage = (): ReactElement => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [filters, setFilters] = useState<LogsFilterValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [payload, setPayload] = useState<ExecutionPayload | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async ({
      append,
      cursor,
    }: {
      append: boolean;
      cursor?: string;
    }): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await listDashboardLogsForSession({
          data: {
            cursor,
            level: filters.level?.trim() || undefined,
            message: filters.message?.trim() || undefined,
            packageSlug: filters.package?.trim() || undefined,
            size: 50,
          },
        });
        setRows((current) =>
          append ? [...current, ...result.data] : result.data
        );
        setNextCursor(result.nextCursor);
        setLoading(false);
      } catch (caughtError) {
        setError(messageFromUnknown(caughtError));
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const run = async (): Promise<void> => {
      await fetchLogs({ append: false });
    };
    void run();
  }, [fetchLogs]);

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (!selected?.executionId) {
        setPayload(null);
        return;
      }
      try {
        const result = await getDashboardLogExecutionForSession({
          data: { executionId: selected.executionId },
        });
        setPayload(result.execution);
      } catch {
        setPayload(null);
      }
    };
    void run();
  }, [selected]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium">Logs</h1>
            <p className="text-muted-foreground text-sm">
              Search console output across your packages.
            </p>
          </div>
          <Button
            onClick={async () => {
              await fetchLogs({ append: false });
            }}
            size="sm"
            variant="outline"
          >
            <IconRefresh data-icon="inline-start" />
            Refresh
          </Button>
        </header>

        <LogsFilterCommand
          filters={filters}
          isLoading={loading}
          onFiltersChange={setFilters}
        />

        {error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
            {error}
          </div>
        ) : null}

        <div className="bg-card min-h-0 overflow-auto rounded-md border">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-card text-muted-foreground sticky top-0 z-10 border-b">
              <tr>
                <th className="w-44 px-3 py-2 font-medium">Timestamp</th>
                <th className="w-20 px-3 py-2 font-medium">Level</th>
                <th className="w-56 px-3 py-2 font-medium">Package</th>
                <th className="w-56 px-3 py-2 font-medium">Function</th>
                <th className="px-3 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr
                  className="hover:bg-muted/50 cursor-pointer"
                  key={`${row.executionId}-${row.timestamp}-${index}`}
                  onClick={() => setSelected(row)}
                >
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 font-medium',
                      levelClassName(row.level)
                    )}
                  >
                    {row.level}
                  </td>
                  <td className="px-3 py-2">
                    @{row.handle}/{row.packageSlug}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.functionSlug}</td>
                  <td className="max-w-[520px] truncate px-3 py-2">
                    {row.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 ? (
            <div className="text-muted-foreground p-10 text-center text-sm">
              No logs match the current filters.
            </div>
          ) : null}
          {loading ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              Loading logs...
            </div>
          ) : null}
        </div>

        {nextCursor ? (
          <Button
            className="self-center"
            disabled={loading}
            onClick={async () => {
              await fetchLogs({ append: true, cursor: nextCursor });
            }}
            variant="outline"
          >
            Load older logs
          </Button>
        ) : null}
      </div>

      <LogDetailsSheet
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        payload={payload}
        selected={selected}
      />
    </main>
  );
};

export const Route = createFileRoute('/d/logs')({
  component: LogsPage,
});
