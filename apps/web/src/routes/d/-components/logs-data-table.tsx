import { flexRender, useTable } from '@tanstack/react-table';
import type { Row, SortingState } from '@tanstack/react-table';
import { useRef } from 'react';
import type { ReactElement, UIEvent } from 'react';

import { dataTableFeatures } from '#/components/data-table/features';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table';
import type { LogsTableRow } from '#/routes/d/-lib/logs-table-row';
import { LOGS_TABLE_COLUMNS } from '#/routes/d/-lib/logs-table-schema';

const ROW_HEIGHT_PX = 28;

export const LogsDataTable = ({
  data,
  hasNextPage,
  isFetching,
  isLoading,
  onLoadMore,
  onRowClick,
  onSortingChange,
  selectedRowId,
  sorting,
}: {
  data: LogsTableRow[];
  hasNextPage: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onRowClick: (row: LogsTableRow) => void;
  onSortingChange: (sorting: SortingState) => void;
  selectedRowId: string | null;
  sorting: SortingState;
}): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useTable({
    columns: LOGS_TABLE_COLUMNS,
    data,
    enableMultiRowSelection: false,
    features: dataTableFeatures,
    getRowId: (row: LogsTableRow) => `${row.executionId}-${row.timestamp}`,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (
      updater: SortingState | ((old: SortingState) => SortingState)
    ) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(next);
    },
    state: { sorting },
  });
  const { rows } = table.getRowModel();

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;
    const remaining =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < ROW_HEIGHT_PX * 4 && hasNextPage && !isFetching) {
      onLoadMore();
    }
  };

  return (
    <div
      className="bg-card min-h-0 flex-1 overflow-auto rounded-md border"
      onScroll={onScroll}
      ref={scrollRef}
    >
      <table className="w-full min-w-[900px] caption-bottom text-left text-[length:var(--app-font-size-ui,12px)]">
        <TableHeader className="bg-card sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className="hover:bg-transparent" key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={
                    header.getSize() ? { width: header.getSize() } : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 && !isLoading ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground h-24 text-center"
                colSpan={LOGS_TABLE_COLUMNS.length}
              >
                No logs match the current filters.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <LogsTableRowView
              key={row.id}
              onClick={onRowClick}
              row={row}
              selected={row.id === selectedRowId}
            />
          ))}
          {isFetching || isLoading ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground text-center"
                colSpan={LOGS_TABLE_COLUMNS.length}
              >
                Loading logs…
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </table>
    </div>
  );
};

const LogsTableRowView = ({
  onClick,
  row,
  selected,
}: {
  onClick: (row: LogsTableRow) => void;
  row: Row<typeof dataTableFeatures, LogsTableRow>;
  selected: boolean;
}): ReactElement => (
  <TableRow
    className="cursor-pointer"
    data-state={selected ? 'selected' : undefined}
    onClick={() => {
      onClick(row.original);
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onClick(row.original);
      }
    }}
    tabIndex={0}
  >
    {row.getVisibleCells().map((cell) => (
      <TableCell className="max-w-0" key={cell.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </TableCell>
    ))}
  </TableRow>
);
