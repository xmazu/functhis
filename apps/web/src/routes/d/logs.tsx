import { IconRefresh } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { TooltipProvider } from '#/components/ui/tooltip';
import { messageFromUnknown } from '#/lib/errors/dashboard';
import { dashboardKeys } from '#/lib/query/dashboard-keys';
import { LogDetailsSheet } from '#/routes/d/-components/log-details-sheet';
import { LogsDataTable } from '#/routes/d/-components/logs-data-table';
import { LogsDatePicker } from '#/routes/d/-components/logs-date-picker';
import type { LogsDateRange } from '#/routes/d/-components/logs-date-picker';
import { LogsFilterCommand } from '#/routes/d/-components/logs-filter-command';
import type { LogsFilterValues } from '#/routes/d/-lib/logs-filter-parser';
import type { LogsTableRow } from '#/routes/d/-lib/logs-table-row';
import {
  getDashboardLogExecutionForSession,
  listDashboardLogsForSession,
} from '#/routes/d/-server/dashboard-logs';
import type { DashboardLogsListResult } from '#/routes/d/-server/dashboard-logs-query.server';

const ui =
  'text-[length:var(--app-font-size-ui,12px)] leading-[var(--app-density-line-height,1.25)]';

interface ExecutionPayload {
  input: string | null;
  output: string | null;
  status: string | null;
}

const DEFAULT_SORTING: SortingState = [{ desc: true, id: 'timestamp' }];

const sortDirectionFromState = (sorting: SortingState): 'asc' | 'desc' => {
  const timestampSort = sorting.find((entry) => entry.id === 'timestamp');
  return timestampSort?.desc === false ? 'asc' : 'desc';
};

const LogsPage = (): ReactElement => {
  const [filters, setFilters] = useState<LogsFilterValues>({});
  const [dateRange, setDateRange] = useState<LogsDateRange>({});
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [selected, setSelected] = useState<LogsTableRow | null>(null);
  const [payload, setPayload] = useState<ExecutionPayload | null>(null);

  const sortDirection = sortDirectionFromState(sorting);
  const queryKey = dashboardKeys.logs({
    endTime: dateRange.endTime,
    level: filters.level,
    message: filters.message,
    packageSlug: filters.package,
    sortDirection,
    startTime: dateRange.startTime,
  });

  const logsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage: DashboardLogsListResult) =>
      lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<DashboardLogsListResult> =>
      listDashboardLogsForSession({
        data: {
          cursor: pageParam,
          endTime: dateRange.endTime,
          level: filters.level?.trim() || undefined,
          message: filters.message?.trim() || undefined,
          packageSlug: filters.package?.trim() || undefined,
          size: 50,
          sortDirection,
          startTime: dateRange.startTime,
        },
      }) as Promise<DashboardLogsListResult>,
    queryKey,
  });

  const rows = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [logsQuery.data]
  );

  const error = logsQuery.error ? messageFromUnknown(logsQuery.error) : null;

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = logsQuery;

  const onLoadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  const selectedRowId = selected
    ? `${selected.executionId}-${selected.timestamp}`
    : null;

  return (
    <TooltipProvider>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3 p-4 md:p-6">
          <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className={`${ui} font-medium`}>Logs</h1>
              <p className={`${ui} text-muted-foreground`}>
                Search console output across your packages.
              </p>
            </div>
            <Button
              onClick={() => {
                void logsQuery.refetch();
              }}
              size="sm"
              variant="outline"
            >
              <IconRefresh data-icon="inline-start" />
              Refresh
            </Button>
          </header>

          <div className="flex shrink-0 items-start gap-2">
            <LogsFilterCommand
              filters={filters}
              isLoading={logsQuery.isFetching}
              onFiltersChange={setFilters}
            />
            <LogsDatePicker onChange={setDateRange} value={dateRange} />
          </div>

          {error ? (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4">
              {error}
            </div>
          ) : null}

          <LogsDataTable
            data={rows}
            hasNextPage={Boolean(hasNextPage)}
            isFetching={isFetchingNextPage}
            isLoading={logsQuery.isLoading}
            onLoadMore={onLoadMore}
            onRowClick={setSelected}
            onSortingChange={setSorting}
            selectedRowId={selectedRowId}
            sorting={sorting}
          />
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
    </TooltipProvider>
  );
};

export const Route = createFileRoute('/d/logs')({
  component: LogsPage,
});
